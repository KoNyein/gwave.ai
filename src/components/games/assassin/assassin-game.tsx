"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { syncBest } from "@/lib/quests";

import { createBloodField, loadBloodPref, saveBloodPref } from "./blood";
import { createGroundSampler, loadMap, type LoadedMap } from "./map-loader";
import { createSfx, type Sfx } from "./sfx";
import { buildArena, createToonFighter, createWeaponModel, type Fighter } from "./toon";

import { applyGpuBudget, gpuRendererOptions } from "@/lib/gpu-budget";

/// Gwave Assassin — ၁၈+ multiplayer mini-game (three.js)。
///
/// ★ ကစားနည်း — လူတိုင်းမှာ လျှို့ဝှက်ပစ်မှတ် တစ်ယောက်စီ။ ကိုယ့်ကို ဘယ်သူ
///   လိုက်နေလဲ မသိရဘူး။ မှန်တဲ့သူရရင် +၁၊ လူမှားရင် −၁။
/// ★ Server က ဆုံးဖြတ်တယ် — client က "ဒီလူကို ဒီနေရာမှာ ထိတယ်" ဆိုပြီး
///   အကြံပြုရုံပဲ။ ပစ်နှုန်း၊ ကျည်၊ အကွာအဝေး၊ ရွေ့လျားမှုအမြန်နှုန်း အားလုံး
///   metaverse server မှာ ပြန်စစ်တယ် (server/metaverse/assassin.js)。
/// ★ Skin က **အလှသာ** — ဘယ်ဟာမှ ကာကွယ်မှု မပေးဘူး။

type Weapon = { my: string; dmg: number; range: number; fireMs: number; ammo: number; splash: number };
type Skin = { my: string; color: number };
type Pub = {
  id: string; name: string; skin: string;
  x: number; y: number; z: number; ry: number;
  hp: number; alive: boolean; kills: number; score: number; weapon: string;
};
type You = {
  id: string; hp: number; alive: boolean; kills: number; score: number;
  wrongKills: number; weapon: string; skin: string;
  ammo: Record<string, number>;
  target: { id: string; name: string } | null;
};

type Feed = { id: number; text: string; good: boolean };

const WS_URL = process.env.NEXT_PUBLIC_MV_WS_URL || "";
function wsCandidates(): string[] {
  const out: string[] = [];
  if (WS_URL) out.push(WS_URL);
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    const same = `wss://${window.location.host}/mv/ws`;
    if (!out.includes(same)) out.push(same);
  }
  return out;
}

const EYE = 1.6;
const SPEED = 8;

/// ★ ကွင်းကို .glb နဲ့ လဲချင်ရင် ဒီ env ကို ထည့်ပါ (ကိုယ့် origin/S3 သာ —
///   CSP က ပြင်ပ host ကို ပိတ်ထားတယ်)。 မထည့်ရင် procedural ကွင်း သုံးတယ်။
const MAP_URL = process.env.NEXT_PUBLIC_ASSASSIN_MAP_URL || "";

export function AssassinGame({ room }: { room: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<{
    you: You | null;
    board: Pub[];
    online: number;
    link: "connecting" | "live" | "denied" | "offline";
    killsToWin: number;
  }>({ you: null, board: [], online: 0, link: "connecting", killsToWin: 3 });
  const [feed, setFeed] = useState<Feed[]>([]);
  const [weapons, setWeapons] = useState<Record<string, Weapon>>({});
  /// null = ကွင်း မတင်ဘူး/ပြီးပြီ · 0–100 = တင်နေဆဲ · -1 = ကျရှုံး
  const [mapPct, setMapPct] = useState<number | null>(MAP_URL ? 0 : null);
  /// သွေး အပြင်းအထန် ၀–၁ (၀ = ပိတ်)。 စက္ကူထဲ မှတ်ထားတယ်။
  const [blood, setBlood] = useState(0.6);
  const bloodRef = useRef(0.6);
  useEffect(() => {
    const v = loadBloodPref();
    setBlood(v);
    bloodRef.current = v;
  }, []);
  const bloodFieldRef = useRef<ReturnType<typeof createBloodField> | null>(null);

  /// အသံ — SFX နဲ့ နောက်ခံသီချင်း သီးခြားစီ ချိန်လို့ရတယ်။
  const [sfxVol, setSfxVol] = useState(0.7);
  const sfxRef = useRef<Sfx | null>(null);
  const [musicVol, setMusicVol] = useState(0.35);
  const [tracks, setTracks] = useState<{ id: string; title: string; url: string }[]>([]);
  const [trackIx, setTrackIx] = useState(0);
  const [musicOn, setMusicOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /// ပွဲတစ်လျှောက် စုဆောင်းထားတဲ့ စာရင်း — ထွက်တဲ့အခါ တစ်ခါတည်း သိမ်းတယ်။
  const careerRef = useRef({ kills: 0, wrong: 0, best: 0 });
  /// ★ `hud` က frame တိုင်း ပြောင်းလို့ scene effect ရဲ့ dep ထဲ မထည့်နိုင်ဘူး —
  ///   ဒါပေမယ့် ပစ်တဲ့အခါ လက်ရှိလက်နက်ကို သိဖို့ လိုတယ်။ ref က အဲဒီကြားခံ။
  const youRef = useRef<You | null>(null);
  const sfxVolRef = useRef(0.7);
  const sendRef = useRef<((m: Record<string, unknown>) => void) | null>(null);

  useEffect(() => {
    if (!started) return;
    const mount = mountRef.current;
    if (!mount) return;

    // ── Scene ──────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ec9e8);
    scene.fog = new THREE.Fog(0x9ec9e8, 45, 95);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
    const renderer = new THREE.WebGLRenderer(gpuRendererOptions());
    // 🔋 ဖုန်းမှာ pixel ratio 1.5 + shadow/antialias ပိတ်
    applyGpuBudget(renderer);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    let arena = 30;
    // ★ .glb မရှိရင် procedural ကွင်း — ဂိမ်းက asset မရှိလည်း ကစားလို့ရရမယ်။
    if (!MAP_URL) buildArena(scene, arena);

    const bloodField = createBloodField(scene, bloodRef.current);
    bloodFieldRef.current = bloodField;
    const sfx = createSfx(sfxVolRef.current);
    sfxRef.current = sfx;
    // ★ ref object ကို ဒီမှာ ကိုင်ထားတယ် — cleanup မှာ `.current` ကို
    //   ဖတ်တာက **တမင်** ပါ (ထွက်ချိန်က နောက်ဆုံးရမှတ် လိုချင်တာ)。
    const career = careerRef;

    let loadedMap: LoadedMap | null = null;
    let ground = createGroundSampler(null);
    if (MAP_URL) {
      void loadMap(MAP_URL, (pct) => setMapPct(pct))
        .then((m) => {
          if (closed) return;
          loadedMap = m;
          ground = createGroundSampler(m);
          scene.add(m.root);
          scene.add(new THREE.HemisphereLight(0xdcefff, 0x8a7d5e, 0.9));
          const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
          sun.position.set(100, 200, 50);
          sun.castShadow = true;
          scene.add(sun);
          setMapPct(null);
        })
        .catch(() => {
          if (closed) return;
          // ★ ကွင်း မတင်နိုင်ရင် ဂိမ်းကို မရပ်ဘူး — procedural ကွင်းနဲ့
          //   ဆက်ကစားလို့ရအောင် ပြန်ဆောက်ပေးတယ်။
          buildArena(scene, arena);
          setMapPct(-1);
        });
    }

    const resize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // ── ကစားသမားများ ───────────────────────────────────────────────────
    type Actor = { fighter: Fighter; data: Pub; target: THREE.Vector3; weapon: THREE.Group | null };
    const actors = new Map<string, Actor>();
    let meId = "";
    let skins: Record<string, Skin> = {};

    const me = { x: 0, y: 0, z: 0, ry: 0, pitch: 0, alive: true };

    function spawnActor(p: Pub) {
      if (actors.has(p.id)) return;
      const skin = skins[p.skin] ?? { my: "", color: 0xe07a5f };
      const fighter = createToonFighter({ color: skin.color, vest: p.skin === "knight" || p.skin === "commander" });
      fighter.group.position.set(p.x, p.y, p.z);
      fighter.group.rotation.y = p.ry;
      fighter.group.userData.playerId = p.id;
      scene.add(fighter.group);
      const w = createWeaponModel(p.weapon);
      fighter.hand.add(w);
      actors.set(p.id, { fighter, data: p, target: new THREE.Vector3(p.x, p.y, p.z), weapon: w });
    }
    function dropActor(id: string) {
      const a = actors.get(id);
      if (!a) return;
      scene.remove(a.fighter.group);
      actors.delete(id);
    }

    // ── ချိတ်ဆက်မှု ────────────────────────────────────────────────────
    let ws: WebSocket | null = null;
    let closed = false;
    let feedSeq = 0;

    const pushFeed = (text: string, good: boolean) => {
      const id = feedSeq++;
      setFeed((f) => [...f.slice(-4), { id, text, good }]);
      setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 5000);
    };

    const send = (m: Record<string, unknown>) => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
    };
    sendRef.current = send;

    (async () => {
      const urls = wsCandidates();
      if (urls.length === 0) {
        setHud((h) => ({ ...h, link: "offline" }));
        return;
      }
      let ticket: string | null = null;
      try {
        const res = await fetch("/api/metaverse/ws-ticket", { cache: "no-store" });
        if (res.ok) ticket = ((await res.json()) as { ticket?: string }).ticket ?? null;
      } catch {
        /* ticket မရရင် server က ငြင်းမယ် — အောက်မှာ ကိုင်တွယ်ထားတယ် */
      }
      if (closed) return;
      const qs = new URLSearchParams({ room });
      if (ticket) qs.set("ticket", ticket);
      ws = new WebSocket(`${urls[0]}?${qs.toString()}`);

      ws.onopen = () => {
        setHud((h) => ({ ...h, link: "live" }));
        send({ type: "aJoin" });
      };
      // ★ 4005/4006 = ဝင်မထားဘူး / ၁၈+ မဟုတ်ဘူး — server ရဲ့ ဆုံးဖြတ်ချက်။
      //   Client မှာ ခလုတ်ဖျောက်ရုံနဲ့ မလုံခြုံလို့ ဂိတ်က server မှာ။
      ws.onclose = (e) => {
        if (closed) return;
        setHud((h) => ({ ...h, link: e.code === 4005 || e.code === 4006 ? "denied" : "offline" }));
      };

      ws.onmessage = (ev) => {
        let m: Record<string, unknown>;
        try {
          m = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (m.type) {
          case "aInit": {
            meId = String(m.id);
            skins = m.skins as Record<string, Skin>;
            setWeapons(m.weapons as Record<string, Weapon>);
            arena = Number(m.arena) || 30;
            setHud((h) => ({ ...h, killsToWin: Number(m.killsToWin) || 3 }));
            for (const p of m.players as Pub[]) {
              if (p.id === meId) {
                me.x = p.x; me.z = p.z; me.ry = p.ry;
              } else spawnActor(p);
            }
            setHud((h) => ({ ...h, board: m.players as Pub[], online: (m.players as Pub[]).length }));
            break;
          }
          case "aEnter": {
            const p = m.player as Pub;
            if (p.id !== meId) spawnActor(p);
            setHud((h) => ({ ...h, board: [...h.board.filter((b) => b.id !== p.id), p], online: h.online + 1 }));
            break;
          }
          case "aLeave": {
            dropActor(String(m.id));
            setHud((h) => ({ ...h, board: h.board.filter((b) => b.id !== m.id), online: Math.max(0, h.online - 1) }));
            break;
          }
          case "aMove": {
            const a = actors.get(String(m.id));
            if (a) {
              a.target.set(Number(m.x), Number(m.y), Number(m.z));
              a.data.ry = Number(m.ry);
            }
            break;
          }
          case "aYou":
            youRef.current = m.you as You;
            setHud((h) => ({ ...h, you: m.you as You }));
            me.alive = (m.you as You).alive;
            break;
          case "aHit": {
            const a = actors.get(String(m.victimId));
            const head = m.hitPart === "head";
            // ★ ကိုယ်ပစ်လိုက်တာ ထိမှန်ကြောင်း အသံ — အဝေးကနေ ပစ်တဲ့အခါ
            //   ဒါတစ်ခုတည်းက ထိ/မထိ ပြောပြနိုင်တဲ့ အရာ။
            if (m.attackerId === meId) sfx.hitMarker(head);
            if (a) {
              a.data.hp = Number(m.hp);
              // ★ ခေါင်းထိရင် ခေါင်းအမြင့်၊ ကိုယ်ထိရင် ရင်အုပ်အမြင့်မှာ —
              //   ဘယ်နေရာ ထိလဲ မြင်ရဖို့။
              const at = a.fighter.group.position.clone();
              at.y += head ? 1.6 : 1.0;
              bloodField.burst(at, head);
            }
            if (m.victimId === meId) {
              flash();
              sfx.hurt();
            }
            break;
          }
          case "aKill": {
            const correct = m.correct === true;
            const mine = m.killerId === meId;
            pushFeed(
              `${m.killerName} → ${m.victimName}${correct ? " ✓" : " ✗ (လူမှား)"}`,
              correct,
            );
            const v = actors.get(String(m.victimId));
            if (v) {
              v.data.alive = false;
              v.fighter.group.visible = false;
            }
            if (m.victimId === meId) me.alive = false;
            if (mine) {
              sfx.kill(correct);
              // ★ တစ်ပွဲပြီးမှ မဟုတ်ဘဲ ဒီမှာ ရေတွက်တယ် — ပွဲက အဆုံးမသတ်ဘဲ
              //   ထွက်သွားတဲ့သူရဲ့ စာရင်းလည်း ကျန်ရမယ်။
              if (correct) careerRef.current.kills++;
              else careerRef.current.wrong++;
              careerRef.current.best = Math.max(
                careerRef.current.best,
                Number(m.killerScore) || 0,
              );
            }
            if (mine && !correct) pushFeed("လူမှားသတ်မိလို့ အမှတ် လျော့သွားတယ်", false);
            break;
          }
          case "aRespawn": {
            const a = actors.get(String(m.id));
            if (a) {
              a.data.alive = true;
              a.data.hp = Number(m.hp);
              a.fighter.group.visible = true;
              a.target.set(Number(m.x), Number(m.y), Number(m.z));
              a.fighter.group.position.copy(a.target);
            }
            if (m.id === meId) {
              me.x = Number(m.x); me.z = Number(m.z); me.alive = true;
            }
            break;
          }
          case "aWin":
            pushFeed(`🏆 ${m.winnerName} အနိုင်ရပါပြီ`, true);
            break;
          case "aReset": {
            for (const p of m.players as Pub[]) {
              const a = actors.get(p.id);
              if (a) {
                a.data = p;
                a.fighter.group.visible = true;
                a.target.set(p.x, p.y, p.z);
              }
              if (p.id === meId) { me.x = p.x; me.z = p.z; me.alive = true; }
            }
            setHud((h) => ({ ...h, board: m.players as Pub[] }));
            pushFeed("ပွဲအသစ် စပါပြီ", true);
            break;
          }
          case "aWeaponOf": {
            const a = actors.get(String(m.id));
            if (a) {
              if (a.weapon) a.fighter.hand.remove(a.weapon);
              a.weapon = createWeaponModel(String(m.weapon));
              a.fighter.hand.add(a.weapon);
            }
            break;
          }
          case "aNoAmmo":
            pushFeed("ကျည် ကုန်သွားပြီ — R နှိပ်ပြီး ဖြည့်ပါ", false);
            break;
          // ★ တခြားသူတွေရဲ့ ပစ်သံ — ဘယ်လက်နက်လဲ ကြားရုံနဲ့ သိရတယ်
          //   (ဘေးမှာ စနိုက်ပါ ရှိလား ဆိုတာ ကစားမှုအချက်အလက်)。
          case "aShot":
            if (m.id !== meId) sfx.shot(String(m.weapon));
            break;
        }
      };
    })();

    // ── ထိမှန်မှု အနီရောင် ────────────────────────────────────────────
    let hurtUntil = 0;
    const flash = () => {
      hurtUntil = performance.now() + 220;
    };

    // ── ထိန်းချုပ်မှု ──────────────────────────────────────────────────
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (e.code === "KeyR") {
        send({ type: "aReload" });
        sfx.resume();
        sfx.reload();
      }
      if (e.code === "Digit1") send({ type: "aWeapon", weapon: "pistol" });
      if (e.code === "Digit2") send({ type: "aWeapon", weapon: "knife" });
      if (e.code === "Digit3") send({ type: "aWeapon", weapon: "sniper" });
      if (e.code === "Digit4") send({ type: "aWeapon", weapon: "bomb" });
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const canvas = renderer.domElement;
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      me.ry -= e.movementX * 0.0022;
      me.pitch = Math.max(-1.2, Math.min(1.2, me.pitch - e.movementY * 0.0022));
    };
    const requestLock = () => {
      if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
    };
    canvas.addEventListener("click", requestLock);
    window.addEventListener("mousemove", onMouseMove);

    // ── ပစ်ခတ်ခြင်း ────────────────────────────────────────────────────
    //
    // ★★ Client က **ကြည့်နေတဲ့ ဦးတည်ချက်ပဲ** ပို့တယ် — ဘယ်သူထိလဲ၊
    //   ခေါင်းလား ကိုယ်လား ဆိုတာ server က ကိုယ့် position data နဲ့ ray
    //   ပစ်ပြီး ဆုံးဖြတ်တယ် (server/metaverse/combat.js)。 အရင်က client
    //   raycast ရဲ့ အဖြေ (`targetId`/`hitPart`) ကို ပို့နေတာ — အဲဒါက
    //   "ခေါင်းထိတယ်" လို့ အမြဲပြောတဲ့ aimbot ကို message တစ်ကြောင်းနဲ့
    //   ရေးလို့ ရစေတယ်။ အခု server က အဲဒီ field တွေကို လုံးဝ မဖတ်တော့ဘူး။
    const ray = new THREE.Raycaster();
    const centre = new THREE.Vector2(0, 0);
    const fire = () => {
      if (!me.alive) return;
      // ★ Browser က user gesture ပြီးမှ audio ခွင့်ပြုတယ် — ပထမပစ်ချက်က
      //   အဲဒီ gesture ပဲ။
      sfx.resume();
      const w = youRef.current?.weapon ?? "pistol";
      sfx.shot(w);
      if (w === "bomb") {
        // ဗုံး — ရှေ့ ၈ မီတာ အကွာကို ပစ်တယ် (server က range ပြန်စစ်တယ်)
        send({ type: "aFire", x: me.x - Math.sin(me.ry) * 8, z: me.z - Math.cos(me.ry) * 8 });
        return;
      }
      ray.setFromCamera(centre, camera);
      const d = ray.ray.direction;
      send({ type: "aFire", dx: d.x, dy: d.y, dz: d.z });
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement === canvas) fire();
    };
    window.addEventListener("mousedown", onMouseDown);

    // ဖုန်းအတွက် — ဖန်သားပြင်ကို ထိရင် ပစ်တယ်
    const onTouch = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (t0 && t0.clientX > window.innerWidth / 2) fire();
    };
    canvas.addEventListener("touchstart", onTouch);

    // ── Loop ───────────────────────────────────────────────────────────
    let raf = 0;
    let last = performance.now();
    let sendAcc = 0;
    let stepAcc = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      // 🔋 မမြင်ရချိန် frame မပုံဖော်ဘူး (WebView/PWA မှာ rAF က မရပ်ဘူး)
      if (document.hidden) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (me.alive) {
        let fx = 0;
        let fz = 0;
        if (keys.has("KeyW")) fz -= 1;
        if (keys.has("KeyS")) fz += 1;
        if (keys.has("KeyA")) fx -= 1;
        if (keys.has("KeyD")) fx += 1;
        const len = Math.hypot(fx, fz);
        if (len > 0) {
          fx /= len;
          fz /= len;
          const sin = Math.sin(me.ry);
          const cos = Math.cos(me.ry);
          me.x += (fx * cos - fz * sin) * SPEED * dt;
          me.z += (-fx * sin - fz * cos) * SPEED * dt;
          stepAcc += dt;
          const r = Math.hypot(me.x, me.z);
          if (r > arena) {
            me.x = (me.x / r) * arena;
            me.z = (me.z / r) * arena;
          }
        }
      }

      // ★ မြေပြင်ပေါ် လိုက်တယ် — ကုန်း/ချောက်ပေါ်မှာ မျက်လုံးအမြင့်က
      //   မြေကနေ အမြဲ တူညီရမယ် (ကွင်းက ပြားချပ်ချပ်ဆိုရင် ၀ ပဲ)。
      me.y = ground.heightAt(me.x, me.z);
      camera.position.set(me.x, me.y + EYE, me.z);
      camera.rotation.set(me.pitch, me.ry, 0, "YXZ");

      // တခြားသူတွေကို ချောချောရွှေ့ + လမ်းလျှောက်ပုံစံ
      for (const a of actors.values()) {
        a.target.y = ground.heightAt(a.target.x, a.target.z);
        a.fighter.group.position.lerp(a.target, Math.min(1, 12 * dt));
        let d = a.data.ry - a.fighter.group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        a.fighter.group.rotation.y += d * Math.min(1, 12 * dt);
        const moving = a.fighter.group.position.distanceToSquared(a.target) > 0.002;
        const sw = moving ? Math.sin(now / 130) * 0.5 : 0;
        a.fighter.legL.rotation.x = sw;
        a.fighter.legR.rotation.x = -sw;
        a.fighter.armL.rotation.x = -sw * 0.6;
      }

      sendAcc += dt;
      if (sendAcc > 1 / 15) {
        sendAcc = 0;
        send({ type: "aMove", x: me.x, y: me.y, z: me.z, ry: me.ry });
      }

      bloodField.update(dt);
      if (stepAcc > 0.42 && me.alive) {
        stepAcc = 0;
        sfx.step();
      }

      renderer.render(scene, camera);
      const el = hurtRef.current;
      if (el) el.style.opacity = now < hurtUntil ? "1" : "0";
    };
    raf = requestAnimationFrame(tick);

    return () => {
      closed = true;
      cancelAnimationFrame(raf);
      if (loadedMap) scene.remove(loadedMap.root);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("click", requestLock);
      canvas.removeEventListener("touchstart", onTouch);
      ws?.close();
      bloodField.dispose();
      bloodFieldRef.current = null;
      // ★ ရမှတ်ကို ထွက်ချိန်မှာ တစ်ခါတည်း သိမ်းတယ် — ပစ်ချက်တိုင်း
      //   ပို့နေရင် ပွဲကြမ်းချိန်မှာ request မိုးရွာမယ်။
      const c = career.current;
      if (c.kills > 0 || c.wrong > 0) {
        syncBest("assassin", c.best, { kills: c.kills, wrongKills: c.wrong });
      }
      sfx.dispose();
      sfxRef.current = null;
      renderer.dispose();
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      sendRef.current = null;
    };
    // ★ `hud` က frame တိုင်း ပြောင်းလို့ dep ထဲ မထည့်ရ — ထည့်ရင် scene
    //   တစ်ခုလုံး ပြန်ဆောက်နေမယ်။
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, room]);

  // ── နောက်ခံသီချင်း — Gwave ရဲ့ music library ကနေ ─────────────────────
  //
  // ★ ဂိမ်းထဲ သီချင်း bundle မလုပ်ဘူး — app မှာ ရှိပြီးသား စာကြည့်တိုက်ကနေ
  //   ယူတယ်။ ဒါဆို အသစ်တင်တိုင်း ဂိမ်းက အလိုအလျောက် ရတယ်၊ ပြီးတော့
  //   အခွင့်အရေး စစ်ဆေးမှုက server မှာ ရှိပြီးသား ဖြစ်နေတယ်။
  useEffect(() => {
    if (!started) return;
    let alive = true;
    void fetch("/api/games/assassin/music", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((j: { tracks?: { id: string; title: string; url: string }[] }) => {
        if (!alive) return;
        const list = j.tracks ?? [];
        // ★ အစဉ်ကို ရောတယ် — ဝင်တိုင်း သီချင်းတစ်ပုဒ်တည်း စရင် ငြီးငွေ့တယ်။
        for (let i = list.length - 1; i > 0; i--) {
          const k = Math.floor(Math.random() * (i + 1));
          [list[i], list[k]] = [list[k]!, list[i]!];
        }
        setTracks(list);
      })
      .catch(() => setTracks([]));
    return () => {
      alive = false;
    };
  }, [started]);

  const current = tracks[trackIx] ?? null;

  /// နောက်တစ်ပုဒ် — စာရင်းအဆုံးရောက်ရင် အစကို ပြန်လှည့်တယ်။
  const nextTrack = useCallback(() => {
    setTrackIx((i) => (tracks.length === 0 ? 0 : (i + 1) % tracks.length));
  }, [tracks.length]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = musicVol;
  }, [musicVol]);

  const hurtRef = useRef<HTMLDivElement | null>(null);
  const you = hud.you;

  /// ★ ချိန်လိုက်တာနဲ့ ချက်ချင်း သက်ရောက်ရမယ် — ဂိမ်းထဲက ထွက်ပြီး ပြန်ဝင်မှ
  ///   ပြောင်းရရင် ချိန်လို့ရတယ် ဆိုတာ အဓိပ္ပာယ် မရှိဘူး။
  const applyBlood = (v: number) => {
    setBlood(v);
    bloodRef.current = v;
    bloodFieldRef.current?.setIntensity(v);
    saveBloodPref(v);
  };

  const bloodSlider = (
    <label className="block">
      <span className="flex items-center justify-between text-[11px]">
        <span>🩸 သွေး</span>
        <span className="tabular-nums opacity-70">
          {blood === 0 ? "ပိတ်" : `${Math.round(blood * 100)}%`}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={10}
        value={Math.round(blood * 100)}
        onChange={(e) => applyBlood(Number(e.target.value) / 100)}
        aria-label="သွေး အပြင်းအထန်"
        className="mt-1 w-full accent-red-500"
      />
    </label>
  );

  if (!started) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold">🎯 Gwave Assassin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          လူတိုင်းမှာ <b>လျှို့ဝှက်ပစ်မှတ်</b> တစ်ယောက်စီ ရှိတယ်။ ကိုယ့်ကို ဘယ်သူ
          လိုက်ရှာနေလဲတော့ မသိရဘူး။ မှန်တဲ့ပစ်မှတ်ကို ရရင် <b>+၁</b>၊ လူမှားရင်{" "}
          <b>−၁</b> — ဒါကြောင့် ပစ်ခတ်တာထက် <b>ရှာဖွေတာ</b> က အဓိကပါ။
        </p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          <li>⌨️ WASD = ရွှေ့ · မောက်စ် = ကြည့် · ကလစ် = ပစ် · R = ကျည်ဖြည့် · 1–4 = လက်နက်</li>
          <li>📱 ဖုန်းမှာ ညာဘက်ခြမ်း ထိရင် ပစ်တယ်</li>
          <li>🎨 Skin တွေက <b>အလှသာ</b> — ဘယ်ဟာမှ ကာကွယ်မှု အပိုမပေးပါ</li>
        </ul>
        {/* ★ စမတိုင်ခင် ချိန်လို့ရအောင် — မကြိုက်တဲ့သူက ၀% ထားပြီး
            လုံးဝ ပိတ်လို့ရတယ်။ */}
        <div className="mt-3 max-w-[260px] text-muted-foreground">{bloodSlider}</div>
        <button
          onClick={() => setStarted(true)}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          ▶ ဝင်မယ်
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border bg-black">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        ref={hurtRef}
        className="pointer-events-none absolute inset-0 bg-red-600/25 opacity-0 transition-opacity duration-150"
      />

      {/* ကွင်း တင်နေချိန် — ဘယ်လောက်ကျန်လဲ မပြရင် ပျက်နေတယ်လို့ ထင်မယ် */}
      {mapPct !== null && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
            {mapPct < 0 ? "ကွင်း မတင်နိုင်ပါ — ရိုးရိုးကွင်းနဲ့ ဆက်ကစားပါမယ်" : `ကွင်း တင်နေသည်… ${mapPct}%`}
          </div>
        </div>
      )}

      {/* ကြက်ခြေခတ် */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70">
        ✛
      </div>

      {/* ဘယ်အပေါ် — ပစ်မှတ် */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/55 px-3 py-2 text-[12px] text-white backdrop-blur">
        {hud.link === "denied" ? (
          <span className="text-amber-300">၁၈+ ဖြစ်ပြီး Gwave အကောင့်နဲ့ ဝင်ထားမှ ကစားလို့ရပါတယ်</span>
        ) : hud.link !== "live" ? (
          <span className="text-white/70">ချိတ်နေသည်…</span>
        ) : you?.target ? (
          <>
            <div className="text-white/60">🎯 ကိုယ့်ပစ်မှတ်</div>
            <div className="text-sm font-bold text-emerald-300">{you.target.name}</div>
          </>
        ) : (
          <span className="text-white/60">ပစ်မှတ် စောင့်နေသည် — လူ ၂ ယောက် လိုတယ်</span>
        )}
      </div>

      {/* ညာအပေါ် — အမှတ်ပေးဇယား */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-black/55 px-3 py-2 text-[11px] text-white backdrop-blur">
        <div className="mb-1 text-white/60">👥 {hud.online} · ⭐ {hud.killsToWin} ရရင် အနိုင်</div>
        {[...hud.board].sort((a, b) => b.score - a.score).slice(0, 5).map((p) => (
          <div key={p.id} className="flex justify-between gap-3">
            <span className="truncate">{p.name}</span>
            <span className="tabular-nums text-emerald-300">{p.score}</span>
          </div>
        ))}
      </div>

      {/* အောက် — ကျန်းမာရေး + ကျည် */}
      {you && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/55 px-3 py-2 text-[12px] text-white backdrop-blur">
          <div className="flex items-center gap-2">
            <span className={you.hp > 40 ? "text-emerald-300" : "text-red-400"}>❤ {you.hp}</span>
            <span className="text-white/70">
              {weapons[you.weapon]?.my ?? you.weapon} ·{" "}
              {you.ammo[you.weapon] === -1 ? "∞" : you.ammo[you.weapon]}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/50">
            ✓ {you.kills} · ✗ {you.wrongKills} · အမှတ် {you.score}
          </div>
        </div>
      )}

      {/* သတင်းစဉ် */}
      <div className="pointer-events-none absolute bottom-3 right-3 space-y-1 text-right text-[11px]">
        {feed.map((f) => (
          <div
            key={f.id}
            className={`rounded bg-black/55 px-2 py-1 backdrop-blur ${f.good ? "text-emerald-300" : "text-amber-300"}`}
          >
            {f.text}
          </div>
        ))}
      </div>

      {/* ── အသံ ── */}
      {/* ★ `loop` မထားဘူး — ဆုံးရင် နောက်တစ်ပုဒ် သွားတယ်။ တစ်ပုဒ်တည်း
          ထပ်ခါထပ်ခါ ဆိုရင် ငါးမိနစ်အကြာမှာ ပိတ်ချင်လာမယ်။ */}
      <audio
        ref={audioRef}
        src={musicOn && current ? current.url : undefined}
        autoPlay={musicOn}
        onEnded={nextTrack}
        // ★ သီချင်းတစ်ပုဒ် ဖွင့်လို့မရရင် ဂိမ်းကို မရပ်ဘဲ ကျော်သွားတယ်။
        onError={nextTrack}
        className="hidden"
      />

      <div className="absolute right-3 top-24 w-40 space-y-1.5 rounded-lg bg-black/55 px-2 py-1.5 text-white backdrop-blur">
        {bloodSlider}
        <label className="block">
          <span className="flex items-center justify-between text-[11px]">
            <span>🔊 အသံ</span>
            <span className="tabular-nums opacity-70">{Math.round(sfxVol * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(sfxVol * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setSfxVol(v);
              sfxVolRef.current = v;
              sfxRef.current?.setVolume(v);
            }}
            aria-label="အသံ အကျယ်"
            className="mt-1 w-full accent-emerald-400"
          />
        </label>

        <div className="border-t border-white/15 pt-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span>🎵 သီချင်း</span>
            <button
              onClick={() => setMusicOn((v) => !v)}
              className="rounded px-1 text-[10px] text-white/70 hover:bg-white/15"
            >
              {musicOn ? "ပိတ်" : "ဖွင့်"}
            </button>
          </div>
          {tracks.length === 0 ? (
            <div className="text-[10px] text-white/45">
              စာကြည့်တိုက်မှာ အခမဲ့သီချင်း မရှိသေးပါ
            </div>
          ) : (
            <>
              <div className="truncate text-[10px] text-white/60" title={current?.title}>
                {musicOn ? (current?.title ?? "…") : "ပိတ်ထားသည်"}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button
                  onClick={nextTrack}
                  className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] hover:bg-white/20"
                  aria-label="နောက်တစ်ပုဒ်"
                >
                  ⏭
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(musicVol * 100)}
                  onChange={(e) => setMusicVol(Number(e.target.value) / 100)}
                  aria-label="သီချင်း အသံအကျယ်"
                  className="w-full accent-sky-400"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* လက်နက် ခလုတ်များ — ဖုန်းအတွက် */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {Object.entries(weapons).map(([k, w]) => (
          <button
            key={k}
            onClick={() => sendRef.current?.({ type: "aWeapon", weapon: k })}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] backdrop-blur transition ${
              you?.weapon === k ? "bg-emerald-500/70 text-white" : "bg-black/55 text-white/75"
            }`}
          >
            {w.my}
          </button>
        ))}
      </div>
    </div>
  );
}
