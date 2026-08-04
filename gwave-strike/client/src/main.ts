import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { MAX_HP, RESPAWN_S, TDM_TARGET, WEAPONS } from "@gwave-strike/shared";

import { Input } from "./core/input";
import { Fx } from "./fx/fx";
import { PlayerController } from "./player/controller";
import { WeaponSystem } from "./player/weapons";
import { BotManager } from "./soldiers/bots";
import { createHud } from "./ui/hud";
import { buildWorld, terrainHeight } from "./world/world";

/// GWAVE STRIKE — Phase 1 client core (blueprint §2).
/// Local playable TDM vs bots; Phase 3 swaps BotManager/local damage for the
/// Colyseus authoritative server, keeping this file's loop intact.

const SOLDIER_URL = "/assets/soldier-placeholder.glb";

async function boot() {
  await RAPIER.init();
  const app = document.getElementById("app")!;

  // ── Renderer (blueprint §2.1 modern defaults) ──
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

  // ── Player (BLUE team) ──
  const spawn = new THREE.Vector3(0, terrainHeight(0, -70) + 2, -70);
  const player = new PlayerController(RAPIER, world.physics, spawn);
  const weapons = new WeaponSystem(camera);
  let hp = MAX_HP;
  let deadUntil = 0;
  let kills = 0;
  const score = { blue: 0, red: 0 };

  // ── Viewmodel gun (simple mesh — real GLB in Phase 2) ──
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.06, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.55 }),
  );
  barrel.position.set(0, 0, -0.25);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.12, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x30363f, roughness: 0.6 }),
  );
  gun.add(barrel, body);
  camera.add(gun);

  // ── Bots: 4 allies + 5 enemies ──
  const bots = new BotManager(world.scene, SOLDIER_URL, 5);

  // Rapier ray for wall distance (hitscan clipping + bot LOS)
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

  hud.banner("🔔 ပွဲစပြီ — BLUE အသင်းအတွက် တိုက်ပါ!");

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    const now = performance.now();
    hud.setLocked(input.locked);

    const alive = now >= deadUntil;

    if (alive) {
      player.update(dt, input, weapons.adsAmount > 0.5);
    }

    // Camera from body + eye height, oriented by yaw/pitch
    const p = player.position;
    camera.position.set(p.x, p.y - 0.85 + player.eyeHeight(), p.z);
    camera.quaternion.setFromEuler(
      new THREE.Euler(input.state.pitch, input.state.yaw, 0, "YXZ"),
    );

    // Gun sway toward ADS sight line
    const adsPos = new THREE.Vector3(0, -0.06, -0.32);
    const hipPos = new THREE.Vector3(0.22, -0.18, -0.45);
    gun.position.copy(hipPos.lerp(adsPos, weapons.adsAmount));

    // ── Fire ──
    if (alive && input.locked) {
      const eye = camera.position.clone();
      const hit = weapons.update(dt, input, eye, bots.targets(0), wallDist);
      if (hit) {
        fx.muzzle();
        fx.tracer(
          eye
            .clone()
            .add(new THREE.Vector3(0.2, -0.15, -0.4).applyQuaternion(camera.quaternion)),
          hit.point,
        );
        if (hit.targetId) {
          hud.hitmarker(hit.head);
          const res = bots.hit(hit.targetId, hit.dmg, now);
          if (res.died) {
            kills += 1;
            score.blue += 1;
            hud.kill(`မင်း ☠ ${hit.targetId} ${hit.head ? "(ခေါင်း)" : ""}`);
            hud.setScore(score.blue, score.red);
            if (score.blue >= TDM_TARGET) hud.banner("🏆 BLUE အနိုင်ရပြီ!");
          }
        }
      }
    }

    // ── Bots ──
    const incoming = bots.update(
      dt,
      now,
      camera.position,
      alive,
      wallDist,
      (a, b) => fx.tracer(a, b),
    );
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
        // respawn position
        const sp = new THREE.Vector3(
          (Math.random() * 2 - 1) * 30,
          terrainHeight(0, -70) + 2,
          -70,
        );
        player.body.setNextKinematicTranslation({ x: sp.x, y: sp.y, z: sp.z });
      }
    }
    hud.setHp(hp);
    hud.setAmmo(
      weapons.mag,
      weapons.reserve,
      weapons.reloading > 0,
    );
    void WEAPONS; // stats consumed inside systems

    fx.update();
    renderer.render(world.scene, camera);
  }
  frame();
}

void boot();
