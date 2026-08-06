import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { MAX_HP, RESPAWN_S, TDM_TARGET } from "@gwave-strike/shared";

import { GameAudio } from "./core/audio";
import { Input } from "./core/input";
import { gltfLoader } from "./core/loaders";
import { attachTouchControls, isTouchDevice } from "./core/touch";
import { Fx } from "./fx/fx";
import { Net } from "./net/net";
import { PlayerController } from "./player/controller";
import { WeaponSystem, type HitTarget } from "./player/weapons";
import { BotManager } from "./soldiers/bots";
import { ScanAvatars, fetchOwnAvatar } from "./soldiers/scanAvatar";
import { Soldier } from "./soldiers/soldier";
import { createHud } from "./ui/hud";
import { createMinimap, type MapDot } from "./ui/minimap";
import { createScoreboard, createSettings, type ScoreRow } from "./ui/panels";
import { buildWorld, terrainHeight } from "./world/world";

/// GWAVE STRIKE — Phase 3 client: multiplayer via Colyseus when the server
/// answers, Phase 1 local-bots TDM when it does not (offline dev, static
/// hosting). The physics/weapons/FSM stack is identical in both modes; only
/// who owns truth changes.

// Vite's base ("/strike/" in production, "/" in dev) — hardcoded absolute
// URLs would 404 behind the Caddy path prefix.
const BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env?.[
    "BASE_URL"
  ] ?? "/";
const SOLDIER_URL = `${BASE}assets/soldier-placeholder.glb`;
const SERVER_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.[
    "VITE_SERVER_URL"
  ] ??
  (location.protocol === "https:"
    ? // Same origin, same path prefix: Caddy strips /strike and the strike
      // container answers both Colyseus matchmaking and the room WS.
      `wss://${location.host}${BASE.replace(/\/$/, "")}`
    : "ws://localhost:2567");

async function boot() {
  await RAPIER.init();
  const app = document.getElementById("app")!;

  // ── Renderer (blueprint §2.1) ──
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  app.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 400);
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const world = buildWorld(RAPIER);
  world.scene.add(camera);

  const input = new Input(renderer.domElement);
  const hud = createHud(app);
  const fx = new Fx(world.scene, camera);
  const loader = gltfLoader(renderer);
  const audio = new GameAudio();
  const touch = isTouchDevice();
  // Phones: smaller minimap so it doesn't crowd the score + kill feed.
  const minimap = createMinimap(hud.root, touch ? 96 : 132);
  const scoreboard = createScoreboard(hud.root);
  createSettings(hud.root, renderer, input);
  if (touch) {
    attachTouchControls(hud.root, input);
    input.touchMode = true; // no pointer lock on phones — game starts live
  }

  // PWA
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    void navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => undefined);
  }

  // Tab scoreboard hold
  let showBoard = false;
  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab") {
      e.preventDefault();
      showBoard = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Tab") showBoard = false;
  });

  // ── Player ──
  const spawn = new THREE.Vector3(0, terrainHeight(0, -70) + 2, -70);
  const player = new PlayerController(RAPIER, world.physics, spawn);
  const weapons = new WeaponSystem(camera);
  let hp = MAX_HP;
  let deadUntil = 0;
  const score = { blue: 0, red: 0 };

  // ── Viewmodel gun ──
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.06, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.55 }),
  );
  barrel.position.set(0, 0, -0.25);
  const gbody = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.12, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x30363f, roughness: 0.6 }),
  );
  gun.add(barrel, gbody);
  camera.add(gun);

  const wallDist = (o: THREE.Vector3, d: THREE.Vector3): number => {
    const hit = world.physics.castRay(
      new RAPIER.Ray({ x: o.x, y: o.y, z: o.z }, { x: d.x, y: d.y, z: d.z }),
      300,
      true,
      undefined,
      undefined,
      undefined,
      player.body,
    );
    return hit ? hit.timeOfImpact : 300;
  };

  // ── Online (Colyseus) or offline (local bots) ──
  // Scan avatars (spec §9): announce our profile id so others render our
  // scanned face; render theirs from the state's avatarId.
  const scanAvatars = new ScanAvatars(loader);
  const ownAvatar = await fetchOwnAvatar();
  const net = new Net();
  let lastMyHp = MAX_HP;
  const online = await net.connect(
    SERVER_URL,
    {
    onKill: (text) => {
      hud.kill(text);
      if (text.startsWith("🏆")) hud.banner(text);
    },
    onScore: (b, r) => {
      score.blue = b;
      score.red = r;
      hud.setScore(b, r);
    },
    onHit: (victimIsMe, _dmg, iAmShooter, head) => {
      if (iAmShooter) {
        hud.hitmarker(head);
        audio.hit();
      }
      if (victimIsMe) hud.damage();
    },
    },
    ownAvatar.userId ?? undefined,
  );

  const bots = online ? null : new BotManager(world.scene, loader, SOLDIER_URL, 5);
  const remoteSoldiers = new Map<string, Soldier>();

  hud.banner(
    online
      ? "🌐 Online — BLUE vs RED, အမှတ် ၅၀ အရင်ပြည့်သူ နိုင်"
      : "🔔 Offline mode — bot တွေနဲ့ ကစားနေသည် (server မတွေ့ပါ)",
  );

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    const now = performance.now();
    hud.setLocked(input.locked);

    if (online) hp = net.myHp;
    const alive = online ? net.myHp > 0 : now >= deadUntil;

    if (alive) player.update(dt, input, weapons.adsAmount > 0.5);

    // Send inputs (online) + soft reconciliation
    if (online && net.room) {
      const s = input.state;
      if (alive) net.sendInput(dt, s.f, s.s, s.run, s.crouch, s.yaw, s.pitch);
      const p = player.position;
      const sv = net.myServerPos;
      const div = Math.hypot(p.x - sv.x, p.z - sv.z);
      if (div > 3) {
        player.body.setNextKinematicTranslation({ x: sv.x, y: sv.y + 0.9, z: sv.z });
      } else if (div > 0.8) {
        player.body.setNextKinematicTranslation({
          x: p.x + (sv.x - p.x) * 0.15,
          y: p.y,
          z: p.z + (sv.z - p.z) * 0.15,
        });
      }
      // Death → respawn banner once
      if (net.myHp <= 0 && lastMyHp > 0) {
        hud.banner(`☠️ ကျဆုံးပြီ — ${RESPAWN_S} စက္ကန့်အတွင်း ပြန်ရှင်မယ်`);
      }
      lastMyHp = net.myHp;
    }

    const p = player.position;
    camera.position.set(p.x, p.y - 0.85 + player.eyeHeight(), p.z);
    camera.quaternion.setFromEuler(
      new THREE.Euler(input.state.pitch, input.state.yaw, 0, "YXZ"),
    );
    const adsPos = new THREE.Vector3(0, -0.06, -0.32);
    const hipPos = new THREE.Vector3(0.22, -0.18, -0.45);
    gun.position.copy(hipPos.lerp(adsPos, weapons.adsAmount));

    // ── Targets ──
    let targets: HitTarget[] = [];
    if (online) {
      for (const id of net.remotes.keys()) {
        const v = net.sample(id);
        if (!v || v.hp <= 0 || v.team === net.myTeam) continue;
        targets.push({
          id,
          body: new THREE.Sphere(new THREE.Vector3(v.x, v.y + 0.95, v.z), 0.45),
          head: new THREE.Sphere(new THREE.Vector3(v.x, v.y + 1.62, v.z), 0.2),
        });
      }
    } else if (bots) {
      targets = bots.targets(0);
    }

    // ── Fire ──
    if (alive && input.locked) {
      const eye = camera.position.clone();
      const hit = weapons.update(dt, input, eye, targets, wallDist);
      if (hit) {
        fx.muzzle();
        audio.shot(0);
        fx.tracer(
          eye
            .clone()
            .add(new THREE.Vector3(0.2, -0.15, -0.4).applyQuaternion(camera.quaternion)),
          hit.point,
        );
        if (online) {
          // Server decides damage — we only report the shot
          const dir = hit.point.clone().sub(eye).normalize();
          net.shoot(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z);
        } else if (bots && hit.targetId) {
          hud.hitmarker(hit.head);
          const res = bots.hit(hit.targetId, hit.dmg, now);
          if (res.died) {
            score.blue += 1;
            hud.kill(`မင်း ☠ ${hit.targetId}${hit.head ? " (ခေါင်း)" : ""}`);
            hud.setScore(score.blue, score.red);
            if (score.blue >= TDM_TARGET) hud.banner("🏆 BLUE အနိုင်ရပြီ!");
          }
        }
      }
    }

    // ── Remotes (online) ──
    if (online) {
      for (const id of net.remotes.keys()) {
        const v = net.sample(id);
        if (!v) continue;
        let s = remoteSoldiers.get(id);
        if (!s) {
          s = new Soldier(loader, SOLDIER_URL, v.team === 0 ? 0x7799ff : 0xff8877);
          remoteSoldiers.set(id, s);
          world.scene.add(s.group);
          if (v.avatarId) scanAvatars.apply(v.avatarId, s);
        }
        s.group.position.set(v.x, v.y, v.z);
        s.group.rotation.y = v.yaw;
        if (v.hp <= 0) {
          if (!s.dead) s.die();
        } else {
          if (s.dead) s.revive();
          if (v.anim === "fire") s.play("fire");
          else s.locomotion(v.anim === "run" ? 6 : v.anim === "walk" ? 2 : 0, true);
        }
        s.update(dt);
      }
      for (const [id, s] of remoteSoldiers) {
        if (!net.remotes.has(id)) {
          world.scene.remove(s.group);
          remoteSoldiers.delete(id);
        }
      }
    }

    // ── Offline bots ──
    if (!online && bots) {
      const incoming = bots.update(dt, now, camera.position, alive, wallDist, (a, b) => {
        fx.tracer(a, b);
        audio.shot(a.distanceTo(camera.position));
      });
      if (incoming > 0 && alive) {
        hp -= incoming;
        hud.damage();
        if (hp <= 0) {
          deadUntil = now + RESPAWN_S * 1000;
          score.red += 1;
          hud.setScore(score.blue, score.red);
          hud.kill("RED ☠ မင်း");
          hud.banner(`☠️ ကျဆုံးပြီ — ${RESPAWN_S} စက္ကန့်အတွင်း ပြန်ရှင်မယ်`);
          hp = MAX_HP;
          const sp = new THREE.Vector3(
            (Math.random() * 2 - 1) * 30,
            terrainHeight(0, -70) + 2,
            -70,
          );
          player.body.setNextKinematicTranslation({ x: sp.x, y: sp.y, z: sp.z });
        }
      }
    }

    hud.setHp(hp);
    hud.setAmmo(weapons.mag, weapons.reserve, weapons.reloading > 0);

    // ── Footsteps (own, grounded movement) ──
    const moving = Math.abs(input.state.f) + Math.abs(input.state.s) > 0.2;
    stepAcc += moving && alive ? dt : 0;
    if (stepAcc > (input.state.run ? 0.32 : 0.45)) {
      stepAcc = 0;
      audio.footstep();
    }

    // ── Minimap ──
    const dots: MapDot[] = [{ x: p.x, z: p.z, team: online ? net.myTeam : 0, me: true }];
    if (online) {
      for (const id of net.remotes.keys()) {
        const v = net.sample(id);
        if (v && v.hp > 0) dots.push({ x: v.x, z: v.z, team: v.team });
      }
    } else if (bots) {
      for (const b of bots.bots) {
        if (b.hp > 0) dots.push({ x: b.pos.x, z: b.pos.z, team: b.team });
      }
    }
    minimap.draw(dots, input.state.yaw);

    // ── Scoreboard (Tab) ──
    const rows: ScoreRow[] = [];
    if (showBoard) {
      if (online) {
        for (const buf of net.remotes.values()) {
          const v = buf[buf.length - 1];
          if (v)
            rows.push({
              name: v.name,
              team: v.team,
              kills: v.kills,
              deaths: v.deaths,
              me: false,
            });
        }
        rows.push({
          name: "မင်း",
          team: net.myTeam,
          kills: net.myKills,
          deaths: net.myDeaths,
          me: true,
        });
      } else if (bots) {
        for (const b of bots.bots) {
          rows.push({ name: b.id, team: b.team, kills: 0, deaths: 0, me: false });
        }
        rows.push({ name: "မင်း", team: 0, kills: 0, deaths: 0, me: true });
      }
    }
    scoreboard.toggle(showBoard, rows);

    fx.update();
    renderer.render(world.scene, camera);
  }
  let stepAcc = 0;
  frame();
}

void boot();
