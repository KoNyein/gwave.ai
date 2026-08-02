"use client";

/// Gwave FPV Simulator — Liftoff-style drone sim (three.js)။
///
/// ★ Physics/input/maps တွေက lib/fpv ထဲမှာ သီးခြား — ဒီ file က scene၊
///   HUD/OSD၊ menu၊ touch stick၊ multiplayer ချိတ်တာပဲ လုပ်တယ်။
/// ★ Multiplayer က metaverse WS server ကိုပဲ သုံးတယ် (room = fpv-<map>)။
///   Server အဟောင်း (fpv room မသိသေး) ဆီ ရောက်ရင် room က "city" ပြန်လာမယ်
///   — အဲဒီအခါ solo ဆက်ကစားပြီး metaverse ထဲ drone မရောနွှစေဘူး။
/// ★ Strike Range ရဲ့ ပစ်မှတ်တွေက စွန့်ပစ်စစ်ယာဉ်အိုတွေသာ — လူပုံစံ ပစ်မှတ်
///   လုံးဝ မထည့်ဘူး (Gwave မှာ လူငယ်တွေပါ သုံးလို့)။

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { connectMetaverse, type NetClient } from "@/components/metaverse/net";
import { CRAFTS, DRONES, getDrone, getMode, MODES, type DroneSpec, type FlightMode } from "@/lib/fpv/drones";
import { createInput, loadAxisMap, saveAxisMap, type AxisMap, type FpvInput } from "@/lib/fpv/input";
import { createGameRuntime, FPV_GAMES, gameAllowsMap, type GameHud } from "@/lib/fpv/gamemodes";
import { buildFpvMap, FPV_MAPS } from "@/lib/fpv/maps";
import { createState, respawn, speedKmh, updateDrone, type Sticks } from "@/lib/fpv/physics";
import { questEvent, syncBest } from "@/lib/quests";

const WS_URL = process.env.NEXT_PUBLIC_MV_WS_URL || "";
function wsCandidates(): string[] {
  const out: string[] = [];
  if (WS_URL) out.push(WS_URL);
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    const so = `wss://${window.location.host}/mv/ws`;
    if (!out.includes(so)) out.push(so);
  }
  return out;
}

const PREF_KEY = "gw-fpv-prefs";
type Prefs = { drone: string; mode: FlightMode; map: string; sound: boolean; game: string };
function loadPrefs(): Prefs {
  const def: Prefs = { drone: "raptor5", mode: "sport", map: "race", sound: true, game: "free" };
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw) return { ...def, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* default နဲ့ ဆက်သွား */
  }
  return def;
}

/// ✈️ Fixed-wing model — fuselage + wing + tailplane + fin + nose prop။
/// Forward = -Z (physics ရဲ့ convention နဲ့ တူညီ)。
function buildPlaneMesh(spec: DroneSpec): { group: THREE.Group; props: THREE.Mesh[] } {
  const g = new THREE.Group();
  const s = spec.scale;
  const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.55 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.7 });
  const isWing = spec.cls === "wing";

  if (isWing) {
    // Flying wing — delta တစ်ခုတည်း (tail မရှိ)
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.62 * s, 1.5 * s, 3), bodyMat);
    wing.rotation.x = -Math.PI / 2;
    wing.scale.set(1.9, 1, 0.12);
    g.add(wing);
    for (const side of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.22 * s, 0.3 * s), trimMat);
      tip.position.set(side * 0.62 * s, 0.09 * s, 0.25 * s);
      g.add(tip);
    }
  } else {
    // Trainer — fuselage + high wing + tail
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.06 * s, 1.4 * s, 10), bodyMat);
    fuse.rotation.x = Math.PI / 2;
    g.add(fuse);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0 * s, 0.045 * s, 0.32 * s), bodyMat);
    wing.position.set(0, 0.1 * s, -0.1 * s);
    g.add(wing);
    const tailPlane = new THREE.Mesh(new THREE.BoxGeometry(0.7 * s, 0.035 * s, 0.2 * s), trimMat);
    tailPlane.position.set(0, 0.03 * s, 0.62 * s);
    g.add(tailPlane);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035 * s, 0.32 * s, 0.24 * s), trimMat);
    fin.position.set(0, 0.18 * s, 0.62 * s);
    g.add(fin);
    // ခြေထောက် (မြေပြင်ပေါ် ပြေးတက်နိုင်အောင် ပုံစံသာ)
    for (const [x, z] of [[-0.22, -0.15], [0.22, -0.15], [0, 0.55]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.22 * s, 6), trimMat);
      leg.position.set(x * s, -0.13 * s, z * s);
      g.add(leg);
    }
  }

  // နှာဖျား prop — throttle နဲ့ လည်တယ်
  const prop = new THREE.Mesh(
    new THREE.CircleGeometry(0.3 * s, 14),
    new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  prop.position.set(0, 0, isWing ? 0.42 * s : -0.72 * s);
  g.add(prop);
  return { group: g, props: [prop] };
}

/// 🚁 Helicopter model — fuselage + tail boom + main rotor disc + tail rotor
function buildHeliMesh(spec: DroneSpec): { group: THREE.Group; props: THREE.Mesh[] } {
  const g = new THREE.Group();
  const s = spec.scale;
  const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7 });

  const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 14, 10), bodyMat);
  cabin.scale.set(1, 0.85, 1.35);
  cabin.position.z = -0.12 * s;
  g.add(cabin);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.02 * s, 1.0 * s, 8), darkMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.z = 0.55 * s;
  g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02 * s, 0.22 * s, 0.16 * s), bodyMat);
  fin.position.set(0, 0.12 * s, 0.98 * s);
  g.add(fin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.24 * s, 6), darkMat);
  mast.position.y = 0.28 * s;
  g.add(mast);
  for (const [x, z] of [[-0.16, 0], [0.16, 0]] as const) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.025 * s, 0.025 * s, 0.7 * s), darkMat);
    skid.position.set(x * s, -0.24 * s, z * s - 0.08 * s);
    g.add(skid);
  }

  const discMat = new THREE.MeshStandardMaterial({
    color: 0xcfd6e4,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const main = new THREE.Mesh(new THREE.CircleGeometry(0.95 * s, 22), discMat);
  main.rotation.x = -Math.PI / 2;
  main.position.y = 0.4 * s;
  g.add(main);
  const tail = new THREE.Mesh(new THREE.CircleGeometry(0.2 * s, 12), discMat);
  tail.position.set(0.05 * s, 0.12 * s, 1.0 * s);
  tail.rotation.y = Math.PI / 2;
  g.add(tail);
  return { group: g, props: [main, tail] };
}

/// Craft အလိုက် model ရွေး — quad / plane / heli
function buildCraftMesh(spec: DroneSpec): { group: THREE.Group; props: THREE.Mesh[] } {
  if (spec.craft === "plane") return buildPlaneMesh(spec);
  if (spec.craft === "heli") return buildHeliMesh(spec);
  return buildDroneMesh(spec);
}

/// Drone 3D model — frame X + canopy + prop ၄ လုံး (procedural, asset မလို)
function buildDroneMesh(spec: DroneSpec): { group: THREE.Group; props: THREE.Mesh[] } {
  const g = new THREE.Group();
  const s = spec.scale;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.6 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.5 });
  // arms (X frame)
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.028 * s, 0.05 * s), frameMat);
    arm.rotation.y = a;
    g.add(arm);
  }
  // stack + canopy
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.07 * s, 0.22 * s), bodyMat);
  body.position.y = 0.045 * s;
  g.add(body);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, 0.12 * s, 4), bodyMat);
  canopy.rotation.x = -Math.PI / 2;
  canopy.position.set(0, 0.07 * s, -0.1 * s);
  g.add(canopy);
  // battery
  const batt = new THREE.Mesh(
    new THREE.BoxGeometry(0.1 * s, 0.05 * s, 0.16 * s),
    new THREE.MeshStandardMaterial({ color: 0x394150, roughness: 0.8 }),
  );
  batt.position.y = -0.03 * s;
  g.add(batt);
  // props — throttle နဲ့ လည်တယ်
  const props: THREE.Mesh[] = [];
  const propMat = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.11 * s, 12), propMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(px * 0.18 * s, 0.035 * s, pz * 0.18 * s);
    g.add(p);
    props.push(p);
  }
  return { group: g, props };
}

/// Kamikaze/crash ပေါက်ကွဲမှု particle burst
function makeExplosion(scene: THREE.Scene, at: THREE.Vector3) {
  const n = 60;
  const pos = new Float32Array(n * 3);
  const vel: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = at.x;
    pos[i * 3 + 1] = at.y;
    pos[i * 3 + 2] = at.z;
    vel.push(
      new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 12, (Math.random() - 0.5) * 14),
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffa040, size: 0.5, transparent: true, opacity: 1 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return {
    pts,
    update(dt: number): boolean {
      const arr = geo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) {
        vel[i]!.y -= 18 * dt;
        arr.setXYZ(
          i,
          arr.getX(i) + vel[i]!.x * dt,
          Math.max(0.05, arr.getY(i) + vel[i]!.y * dt),
          arr.getZ(i) + vel[i]!.z * dt,
        );
      }
      arr.needsUpdate = true;
      mat.opacity -= dt * 0.9;
      if (mat.opacity <= 0) {
        scene.remove(pts);
        geo.dispose();
        mat.dispose();
        return false;
      }
      return true;
    },
  };
}

/// မော်တာသံ — WebAudio oscillator (throttle နဲ့ pitch တက်)
function makeMotorSound() {
  let ctx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  return {
    start() {
      if (ctx) {
        void ctx.resume();
        return;
      }
      try {
        ctx = new AudioContext();
        osc = ctx.createOscillator();
        osc.type = "sawtooth";
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 900;
        gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(filter).connect(gain).connect(ctx.destination);
        osc.start();
      } catch {
        ctx = null;
      }
    },
    update(throttle: number, armed: boolean, muted: boolean) {
      if (!ctx || !osc || !gain) return;
      const want = armed && !muted ? 0.05 + throttle * 0.09 : 0;
      gain.gain.setTargetAtTime(want, ctx.currentTime, 0.05);
      osc.frequency.setTargetAtTime(70 + throttle * 260, ctx.currentTime, 0.06);
    },
    dispose() {
      try {
        osc?.stop();
        void ctx?.close();
      } catch {
        /* ပိတ်ပြီးသား */
      }
      ctx = null;
    },
  };
}

type Hud = {
  armed: boolean;
  crashed: boolean;
  kmh: number;
  alt: number;
  batt: number;
  lap: string;
  best: string;
  gate: string;
  score: number;
  online: number;
  mp: "solo" | "connecting" | "live";
};

export function FpvSim() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [started, setStarted] = useState(false);
  const [menu, setMenu] = useState(true);
  const [tab, setTab] = useState<"game" | "mode" | "drone" | "map" | "controller">("game");
  /// Drone tab ရဲ့ ယာဉ်အမျိုးအစား filter (UI သာ — prefs.drone က အမှန်တရား)
  const [craft, setCraft] = useState<DroneSpec["craft"]>("quad");
  const [gameHud, setGameHud] = useState<GameHud | null>(null);
  /// ပွဲ ပြန်စချိန် scene ကို အသစ်ဆောက်ဖို့
  const [runNonce, setRunNonce] = useState(0);
  const [axisMap, setAxisMap] = useState<AxisMap | null>(null);
  const [padName, setPadName] = useState<string | null>(null);
  const [hud, setHud] = useState<Hud>({
    armed: false,
    crashed: false,
    kmh: 0,
    alt: 0,
    batt: 0,
    lap: "--",
    best: "--",
    gate: "",
    score: 0,
    online: 1,
    mp: "connecting",
  });
  const [touchDev, setTouchDev] = useState(false);

  const modeRef = useRef<FlightMode>("sport");
  const inputRef = useRef<FpvInput | null>(null);
  const stickL = useRef<HTMLDivElement | null>(null);
  const stickR = useRef<HTMLDivElement | null>(null);
  const knobL = useRef<HTMLDivElement | null>(null);
  const knobR = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const p = loadPrefs();
    setPrefs(p);
    // ရွေးထားတဲ့ ယာဉ်ရဲ့ အမျိုးအစားကို filter ရဲ့ default အဖြစ် ထား
    setCraft(getDrone(p.drone).craft);
    setAxisMap(loadAxisMap());
    setTouchDev(window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
  }, []);

  const save = (p: Prefs) => {
    setPrefs(p);
    try {
      window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };

  // Controller ချိတ်/ဖြုတ် ကို menu မှာ ပြဖို့ poll (menu ဖွင့်ထားချိန်ပဲ)
  useEffect(() => {
    if (!menu) return;
    const t = setInterval(() => {
      const pads = navigator.getGamepads?.() ?? [];
      const g = Array.from(pads).find((p) => p && p.axes.length >= 4);
      setPadName(g?.id ?? null);
    }, 800);
    return () => clearInterval(t);
  }, [menu]);

  // ── Scene ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!started || !prefs || !axisMap) return;
    const mount = mountRef.current;
    if (!mount) return;

    const drone = getDrone(prefs.drone);
    const map = buildFpvMap(prefs.map);
    modeRef.current = prefs.mode;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(map.sky);
    scene.fog = new THREE.Fog(map.fog, 30, map.fogFar);
    scene.add(map.group);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.85));
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.1);
    sun.position.set(60, 90, 40);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(105, 1, 0.05, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1 : 1.75));
    mount.appendChild(renderer.domElement);
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    onResize();
    window.addEventListener("resize", onResize);

    // ကိုယ့် drone — FPV ကင်မရာက drone ထဲမှာ ရှိလို့ ကိုယ့် mesh ကို
    // မပြဘူး (မဖျောက်ရင် frame/prop တွေက မျက်နှာပြင်ကို ကွယ်နေတယ်)။
    // Remote player တွေကတော့ ကိုယ့် drone ကို သူတို့ဘက်မှာ မြင်ရတယ်။
    const { group: droneMesh, props } = buildCraftMesh(drone);
    droneMesh.visible = false;
    scene.add(droneMesh);
    const state = createState(map.spawn, map.spawnYaw);

    const input = createInput(axisMap);
    inputRef.current = input;
    const sound = makeMotorSound();

    // ── Multiplayer — metaverse server ရဲ့ room (fpv-<map>) ──────────────
    const remotes = new Map<string, { mesh: THREE.Group; cur: THREE.Vector3; target: THREE.Vector3; ry: number; tRy: number }>();
    let net: NetClient | null = null;
    let mpState: Hud["mp"] = "solo";
    let online = 1;
    const wsUrls = wsCandidates();
    const roomWanted = `fpv-${map.id}`;
    const addRemote = (id: string, x: number, y: number, z: number, ry: number) => {
      if (remotes.has(id)) return;
      const spec = DRONES[Math.abs([...id].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % DRONES.length]!;
      const { group } = buildCraftMesh(spec);
      scene.add(group);
      remotes.set(id, { mesh: group, cur: new THREE.Vector3(x, y, z), target: new THREE.Vector3(x, y, z), ry, tRy: ry });
    };
    if (wsUrls.length) {
      mpState = "connecting";
      net = connectMetaverse(wsUrls, roomWanted, {
        onInit: ({ room, players }) => {
          // ★ Server အဟောင်းက fpv room မသိရင် "city" ပြန်လာတယ် —
          //   metaverse ထဲ drone မရောအောင် solo ကို ချက်ချင်း ပြန်ဆင်း။
          if (room !== roomWanted) {
            mpState = "solo";
            net?.close();
            return;
          }
          mpState = "live";
          for (const [rid, s] of Object.entries(players)) addRemote(rid, s.x, s.y, s.z, s.ry);
          online = Object.keys(players).length + 1;
        },
        onJoin: (id, s) => {
          addRemote(id, s.x, s.y, s.z, s.ry);
          online += 1;
        },
        onLeave: (id) => {
          const r = remotes.get(id);
          if (r) {
            scene.remove(r.mesh);
            remotes.delete(id);
          }
          online = Math.max(1, online - 1);
        },
        onUpdate: (id, x, y, z, ry) => {
          const r = remotes.get(id);
          if (!r) {
            addRemote(id, x, y, z, ry);
            return;
          }
          r.target.set(x, y, z);
          r.tRy = ry;
        },
        onCorrect: (x, y, z) => {
          state.pos.set(x, y, z);
          state.vel.set(0, 0, 0);
        },
        onStatus: (ok) => {
          if (mpState !== "solo") mpState = ok ? "live" : "connecting";
        },
      });
    }

    // ── Race / strike state ──────────────────────────────────────────────
    let nextGate = 0;
    let lapStart = 0;
    let lastLap = 0;
    let bestLap = 0;
    try {
      bestLap = Number(window.localStorage.getItem(`gw-fpv-best-${map.id}`)) || 0;
    } catch {
      /* ignore */
    }
    let score = 0;
    let flewThisSession = false;
    const explosions: ReturnType<typeof makeExplosion>[] = [];

    const doRespawn = () => {
      respawn(state, map.spawn, map.spawnYaw);
      nextGate = 0;
      lapStart = 0;
    };

    // ── ပွဲစဉ် runtime (Race / Rush / Balloon / Strike / Landing) ────────
    const game = createGameRuntime(prefs.game, scene, map, (at) =>
      explosions.push(makeExplosion(scene, at)),
    );
    let gameDone = false;
    setGameHud(null);

    // ── Loop ─────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    let hudAcc = 0;
    let sendAcc = 0;
    const camQ = new THREE.Quaternion();
    const camTiltQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      (drone.camTilt * Math.PI) / 180,
    );
    const fmt = (ms: number) => (ms > 0 ? `${(ms / 1000).toFixed(2)}s` : "--");

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);

      const sticks: Sticks = input.read(dt);
      if (input.consumeArmToggle()) {
        if (state.crashed) doRespawn();
        state.armed = !state.armed;
        if (state.armed) {
          sound.start();
          // Quest — session တစ်ခုမှာ တစ်ခါပဲ ရေတွက်တယ်
          if (!flewThisSession) {
            flewThisSession = true;
            questEvent("fpv_fly");
          }
        }
      }
      if (input.consumeRespawn()) doRespawn();

      const wasCrashed = state.crashed;
      updateDrone(state, drone, modeRef.current, sticks, dt, map.colliders);
      if (state.crashed && !wasCrashed) {
        explosions.push(makeExplosion(scene, state.pos.clone()));
      }

      // Battery ကုန်ရင် auto-disarm (OSD timer နဲ့ တွဲ)
      if (state.flightSec > drone.batterySec) state.armed = false;

      // ── Race gates ────────────────────────────────────────────────────
      if (map.gates.length > 0) {
        const g = map.gates[nextGate]!;
        if (state.pos.distanceTo(g.pos) < g.radius) {
          if (nextGate === 0) {
            if (lapStart > 0) {
              lastLap = performance.now() - lapStart;
              if (bestLap === 0 || lastLap < bestLap) {
                bestLap = lastLap;
                try {
                  window.localStorage.setItem(`gw-fpv-best-${map.id}`, String(Math.round(bestLap)));
                } catch {
                  /* ignore */
                }
                // Cross-device sync — lap time သေးလေကောင်းလေမို့ data ထဲ ms
                // အနေနဲ့ သိမ်းတယ် (best column က ကြီးလေကောင်းလေ သဘော)
                syncBest(`fpv-lap-${map.id}`, 0, { bestLapMs: Math.round(bestLap) });
              }
            }
            lapStart = performance.now();
          }
          nextGate = (nextGate + 1) % map.gates.length;
        }
      }

      // ── Strike targets (kamikaze) ────────────────────────────────────
      for (const t of map.targets) {
        if (!t.alive) {
          if (t.respawnAt > 0 && performance.now() > t.respawnAt) {
            t.alive = true;
            t.mesh.visible = true;
          }
          continue;
        }
        if (state.armed && state.pos.distanceTo(t.pos) < t.radius) {
          t.alive = false;
          t.mesh.visible = false;
          t.respawnAt = performance.now() + 25_000;
          score += 1;
          explosions.push(makeExplosion(scene, t.pos.clone()));
          // Kamikaze — drone လည်း ပျက်တယ်၊ spawn ပြန်စ
          state.crashed = true;
          state.armed = false;
        }
      }

      for (let i = explosions.length - 1; i >= 0; i--) {
        if (!explosions[i]!.update(dt)) explosions.splice(i, 1);
      }

      // ── Drone mesh + props ───────────────────────────────────────────
      droneMesh.position.copy(state.pos);
      droneMesh.quaternion.copy(state.quat);
      // Rotor/prop လှည့်နှုန်း — 🚁 heli က collective မို့ throttle နည်းလည်း
      // rotor က အမြန်လှည့်နေတယ် (idle head speed)。
      const spin =
        drone.craft === "heli"
          ? state.armed
            ? 2.6
            : 0
          : (0.4 + sticks.throttle * 2.4) * (state.armed ? 1 : 0);
      for (const p of props) p.rotation.z += spin;

      // ── FPV camera — drone body + cam tilt၊ cinematic မှာ smoothing ──
      const m = getMode(modeRef.current);
      camQ.copy(state.quat).multiply(camTiltQ);
      if (m.camSmooth > 0) camera.quaternion.slerp(camQ, 1 - Math.pow(m.camSmooth, dt * 60));
      else camera.quaternion.copy(camQ);
      camera.position.copy(state.pos);

      // ── Remotes ──────────────────────────────────────────────────────
      for (const r of remotes.values()) {
        const k = Math.min(1, 12 * dt);
        r.cur.lerp(r.target, k);
        let d = r.tRy - r.ry;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        r.ry += d * k;
        r.mesh.position.copy(r.cur);
        r.mesh.rotation.y = r.ry;
      }
      sendAcc += dt;
      if (net && sendAcc > 1 / 15) {
        sendAcc = 0;
        const e = new THREE.Euler().setFromQuaternion(state.quat, "YXZ");
        net.sendUpdate(state.pos.x, state.pos.y, state.pos.z, e.y);
      }

      sound.update(sticks.throttle, state.armed, !prefs.sound);

      // ── ပွဲစဉ် update ────────────────────────────────────────────────
      const gh = game.update(dt, state.pos, state.vel, state.armed);
      if (gh.done && !gameDone) {
        gameDone = true;
        // Cross-device best + quest — ပွဲပြီးမှ တစ်ခါတည်း
        syncBest(`fpv-${prefs.game}-${map.id}`, gh.done.score);
        setGameHud(gh);
      }

      // Touch stick knob တွေ ရွှေ့ (DOM direct — re-render မလို)
      const ts = input.touchState();
      if (knobL.current) knobL.current.style.transform = `translate(${ts.lx * 34}px, ${ts.ly * 34}px)`;
      if (knobR.current) knobR.current.style.transform = `translate(${ts.rx * 34}px, ${ts.ry * 34}px)`;

      // ── OSD (5Hz) ────────────────────────────────────────────────────
      hudAcc += dt;
      if (hudAcc > 0.2) {
        hudAcc = 0;
        if (!gameDone) setGameHud(gh.mission ? gh : null);
        setHud({
          armed: state.armed,
          crashed: state.crashed,
          kmh: Math.round(speedKmh(state)),
          alt: Math.round(state.pos.y),
          batt: Math.max(0, Math.round(drone.batterySec - state.flightSec)),
          lap: fmt(lapStart > 0 ? performance.now() - lapStart : lastLap),
          best: fmt(bestLap),
          gate: map.gates.length ? `${nextGate}/${map.gates.length}` : "",
          score,
          online,
          mp: mpState,
        });
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      game.dispose();
      input.dispose();
      inputRef.current = null;
      sound.dispose();
      net?.close();
      renderer.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mm = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      });
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [started, prefs, axisMap, runNonce]);

  // ── Touch stick pointer handlers ─────────────────────────────────────
  const bindStick = (
    ref: RefObject<HTMLDivElement | null>,
    set: (x: number, y: number) => void,
    springY: boolean,
  ) => {
    const el = ref.current;
    if (!el) return () => undefined;
    let pid: number | null = null;
    const move = (e: PointerEvent) => {
      if (pid !== e.pointerId) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      set(x, y);
    };
    const down = (e: PointerEvent) => {
      pid = e.pointerId;
      el.setPointerCapture(e.pointerId);
      move(e);
    };
    const up = (e: PointerEvent) => {
      if (pid !== e.pointerId) return;
      pid = null;
      // Spring — pitch/roll stick က center ပြန်တယ်၊ throttle stick ကတော့
      // yaw ပဲ center ပြန်ပြီး throttle တန်ဖိုး ကိုင်ထားတယ် (radio အတိုင်း)
      if (springY) set(0, 0);
      else set(0, inputRef.current?.touchState().ly ?? 0);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  };

  useEffect(() => {
    if (!started) return;
    const offL = bindStick(stickL, (x, y) => inputRef.current?.setTouchLeft(x, y), false);
    const offR = bindStick(stickR, (x, y) => inputRef.current?.setTouchRight(x, y), true);
    return () => {
      offL();
      offR();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!prefs || !axisMap) {
    return <div className="flex h-full w-full items-center justify-center bg-[#0a0e24] text-white/60">…</div>;
  }

  const btn =
    "rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[12px] text-white/85 backdrop-blur transition hover:bg-black/70";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0e24]">
      <div ref={mountRef} className="absolute inset-0" />

      {/* ── OSD ─────────────────────────────────────────────────────────── */}
      {started && (
        <>
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-black/45 px-3 py-2 text-[11px] leading-relaxed text-white/85 backdrop-blur">
            <div className="font-semibold text-emerald-300">
              {getDrone(prefs.drone).name} · {getMode(prefs.mode).id.toUpperCase()}
            </div>
            <div>
              {hud.kmh} km/h · ⛰ {hud.alt}m · 🔋 {Math.floor(hud.batt / 60)}:{String(hud.batt % 60).padStart(2, "0")}
            </div>
            {hud.gate && (
              <div>
                🏁 Gate {hud.gate} · Lap {hud.lap} · Best {hud.best}
              </div>
            )}
            {prefs.map === "range" && <div>💥 Score {hud.score}</div>}
            <div className={hud.mp === "live" ? "text-emerald-400" : "text-white/45"}>
              {hud.mp === "live" ? `👥 ${hud.online} online` : hud.mp === "connecting" ? "ချိတ်နေသည်…" : "Solo"}
            </div>
          </div>

          {/* ── ပွဲစဉ် mission bar ── */}
          {gameHud?.mission && !gameHud.done && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-10 max-w-[70vw] -translate-x-1/2 truncate rounded-full bg-black/55 px-4 py-1.5 text-[12px] text-amber-200 backdrop-blur">
              {gameHud.mission}
              {gameHud.timeLeft !== undefined && ` · ⏱ ${Math.ceil(gameHud.timeLeft)}s`}
              {gameHud.score !== undefined && ` · 🏆 ${gameHud.score}`}
            </div>
          )}

          {/* ── ပွဲပြီး results ── */}
          {gameHud?.done && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-[min(20rem,90vw)] rounded-3xl border border-white/15 bg-[#101a33] p-6 text-center">
                <div className="text-lg font-extrabold">{gameHud.done.title}</div>
                <div className="mt-1 text-sm text-white/70">{gameHud.done.detail}</div>
                <div className="mt-2 text-2xl font-extrabold text-emerald-300">
                  🏆 {gameHud.done.score}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setGameHud(null);
                      setRunNonce((n) => n + 1);
                    }}
                    className="flex-1 rounded-xl border border-emerald-400/60 bg-emerald-500/25 px-3 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/40"
                  >
                    🔁 ထပ်ကစား
                  </button>
                  <button
                    onClick={() => {
                      setGameHud(null);
                      setStarted(false);
                      setMenu(true);
                    }}
                    className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    ⚙ Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Center notices */}
          {!hud.armed && !hud.crashed && (
            <div className="pointer-events-none absolute left-1/2 top-1/3 z-10 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-xs text-white/85 backdrop-blur">
              Space / ⚡ ခလုတ်နဲ့ ARM လုပ်ပြီး throttle တင်ပါ
            </div>
          )}
          {hud.crashed && (
            <div className="pointer-events-none absolute left-1/2 top-1/3 z-10 -translate-x-1/2 rounded-full border border-red-400/50 bg-black/65 px-4 py-2 text-xs text-red-200 backdrop-blur">
              💥 Crash — R / ⚡ နဲ့ ပြန်စပါ
            </div>
          )}

          {/* ညာအပေါ် ခလုတ်တန်း */}
          <div className="absolute right-3 top-3 z-10 flex gap-2">
            <button className={btn} onClick={() => inputRef.current?.queueArm()}>
              ⚡ {hud.armed ? "Disarm" : hud.crashed ? "ပြန်စ" : "Arm"}
            </button>
            <button
              className={btn}
              onClick={() => save({ ...prefs, sound: !prefs.sound })}
              title="မော်တာသံ"
            >
              {prefs.sound ? "🔊" : "🔇"}
            </button>
            <button
              className={btn}
              onClick={() => {
                setStarted(false);
                setMenu(true);
              }}
            >
              ⚙ Menu
            </button>
          </div>

          {/* Touch sticks — throttle/yaw (ဘယ်) · pitch/roll (ညာ) */}
          {touchDev && (
            <>
              <div
                ref={stickL}
                className="absolute bottom-6 left-6 z-10 h-28 w-28 touch-none rounded-full border border-white/20 bg-black/30 backdrop-blur"
              >
                <div
                  ref={knobL}
                  className="pointer-events-none absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/30"
                />
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-white/50">THR·YAW</span>
              </div>
              <div
                ref={stickR}
                className="absolute bottom-6 right-6 z-10 h-28 w-28 touch-none rounded-full border border-white/20 bg-black/30 backdrop-blur"
              >
                <div
                  ref={knobR}
                  className="pointer-events-none absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/30"
                />
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-white/50">PITCH·ROLL</span>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Menu ─────────────────────────────────────────────────────────── */}
      {menu && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0a0e24]/95 p-4 text-white backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-xl font-extrabold tracking-tight">
              🛸 Gwave FPV Simulator
            </h1>
            <p className="mt-0.5 text-xs text-white/55">
              Liftoff-style drone sim — keyboard / touch / USB·BT controller (RadioMaster စတဲ့ radio joystick mode)။
            </p>

            <div className="mt-3 flex gap-1 rounded-lg bg-white/5 p-1 text-[12px]">
              {(
                [
                  ["game", "🎯 ပွဲ"],
                  ["mode", "🎚 Mode"],
                  ["drone", "🛸 Drone"],
                  ["map", "🗺 Map"],
                  ["controller", "🎮"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-md px-2 py-1.5 transition ${tab === id ? "bg-emerald-500/25 text-emerald-200" : "text-white/60 hover:bg-white/10"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "game" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {FPV_GAMES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      // ပွဲက လက်ရှိ map မှာ မကစားလို့ရရင် ပထမ allowed map
                      // ကို အလိုအလျောက် ပြောင်းပေးတယ်
                      const mapOk = gameAllowsMap(g, prefs.map);
                      const nextMap = mapOk || g.maps === "all" ? prefs.map : g.maps[0]!;
                      save({ ...prefs, game: g.id, map: nextMap });
                    }}
                    className={`rounded-xl border p-3 text-left transition ${prefs.game === g.id ? "border-emerald-400/60 bg-emerald-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                  >
                    <div className="text-sm font-bold">
                      {g.emoji} {g.nameMy}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-white/55">{g.blurbMy}</div>
                    {g.maps !== "all" && (
                      <div className="mt-1 text-[10px] text-white/40">
                        Map: {g.maps.map((m) => FPV_MAPS.find((x) => x.id === m)?.nameMy ?? m).join(" · ")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {tab === "mode" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => save({ ...prefs, mode: m.id })}
                    className={`rounded-xl border p-3 text-left transition ${prefs.mode === m.id ? "border-emerald-400/60 bg-emerald-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                  >
                    <div className="text-sm font-bold">{m.nameMy}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-white/55">{m.blurbMy}</div>
                  </button>
                ))}
              </div>
            )}

            {tab === "drone" && (
              <div className="mt-3 space-y-4">
                {/* ယာဉ်အမျိုးအစား filter — FPV drone / လေယာဉ် / ဟယ်လီ */}
                <div className="flex gap-1 rounded-lg bg-white/5 p-1 text-[12px]">
                  {CRAFTS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCraft(c.id)}
                      className={`flex-1 rounded-md px-2 py-1.5 transition ${craft === c.id ? "bg-emerald-500/25 text-emerald-200" : "text-white/60 hover:bg-white/10"}`}
                    >
                      {c.emoji} {c.nameMy}
                    </button>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {DRONES.filter((d) => d.craft === craft).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => save({ ...prefs, drone: d.id })}
                      className={`rounded-xl border p-3 text-left transition ${prefs.drone === d.id ? "border-emerald-400/60 bg-emerald-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold">{d.name}</span>
                        <span className="shrink-0 rounded bg-white/10 px-1.5 text-[10px] text-white/60">
                          {d.cls} · {d.size}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-white/55">{d.blurbMy}</div>
                      <div className="mt-1 text-[10px] text-white/40">
                        {Math.round(d.mass * 1000)}g · T/W {(d.maxThrust / (d.mass * 9.81)).toFixed(1)} · cam {d.camTilt}°
                        {d.craft === "plane" && ` · stall ${d.stallSpeed} m/s`}
                      </div>
                    </button>
                  ))}
                </div>

                {/* ယာဉ်အလိုက် မောင်းနည်း — physics မတူလို့ ရှင်းပြရမယ် */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-white/60">
                  {craft === "quad" && (
                    <>
                      <b className="text-white/85">🛸 FPV Drone (multirotor)</b> — Throttle က
                      တိုက်ရိုက် rotor အား။ Acro mode မှာ stick လွှတ်လည်း မညီပြန်ဘူး၊
                      ကိုယ်တိုင် ချိန်ရတယ်။ Freestyle/flip/dive အတွက် ဒါပဲ။
                    </>
                  )}
                  {craft === "plane" && (
                    <>
                      <b className="text-white/85">✈️ လေယာဉ် (fixed-wing)</b> — Throttle က
                      ရှေ့တွန်းအား၊ အပေါ်တင်အား (lift) က <b>အရှိန်</b> ကနေ လာတယ်။
                      မြေပြင်မှာ throttle အပြည့်တင်ပြီး ပြေးထွက်၊ အရှိန်ရမှ pitch ဆွဲတင်ပါ။
                      Stall speed အောက် ကျရင် နှာခေါင်း စိုက်ကျမယ် — မဆွဲမြှင့်ဘဲ
                      အရှိန်ပြန်ယူပါ။ Rudder (yaw) က ညံ့တယ်၊ ကွေ့ဖို့ roll + pitch သုံးပါ။
                    </>
                  )}
                  {craft === "heli" && (
                    <>
                      <b className="text-white/85">🚁 ဟယ်လီကော်ပတာ</b> — Collective pitch:
                      throttle <b>တစ်ဝက်ခန့်</b> မှာ hover ဖြစ်တယ် (တက်/ဆင်း ကို throttle နဲ့
                      ချိန်)။ Cyclic (pitch/roll) နဲ့ တိမ်းရွှေ့၊ tail (yaw) နဲ့ လှည့်ပါ။
                      Rotor က armed ဖြစ်တာနဲ့ အမြန်လှည့်နေတယ်။
                    </>
                  )}
                </div>
              </div>
            )}

            {tab === "map" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {FPV_MAPS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      // Map အသစ်မှာ လက်ရှိပွဲ ကစားလို့မရရင် Free Fly ပြန်ထား
                      const g = FPV_GAMES.find((x) => x.id === prefs.game);
                      const game = g && gameAllowsMap(g, m.id) ? prefs.game : "free";
                      save({ ...prefs, map: m.id, game });
                    }}
                    className={`rounded-xl border p-3 text-left transition ${prefs.map === m.id ? "border-emerald-400/60 bg-emerald-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                  >
                    <div className="text-sm font-bold">
                      {m.emoji} {m.nameMy}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-white/55">{m.blurbMy}</div>
                  </button>
                ))}
                <p className="text-[10px] leading-snug text-white/40 sm:col-span-2">
                  Strike Range ရဲ့ ပစ်မှတ်တွေက စွန့်ပစ်ထားတဲ့ စစ်ယာဉ်အိုတွေနဲ့ မီးပုံးတွေသာ ဖြစ်ပါတယ် — score attack ကစားနည်းသာ ဖြစ်ပြီး လူပုံစံ ပစ်မှတ် မပါဝင်ပါ။
                </p>
              </div>
            )}

            {tab === "controller" && (
              <div className="mt-3 space-y-3 text-[12px]">
                <div className={`rounded-lg px-3 py-2 ${padName ? "bg-emerald-500/15 text-emerald-200" : "bg-white/5 text-white/55"}`}>
                  {padName ? `🎮 ${padName}` : "Controller မတွေ့သေးပါ — radio ကို USB (joystick mode) / Bluetooth နဲ့ ချိတ်ပြီး stick တစ်ချက် လှုပ်ပါ။"}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["roll", "pitch", "throttle", "yaw"] as const).map((k) => (
                    <label key={k} className="rounded-lg bg-white/5 p-2">
                      <span className="block text-[10px] uppercase text-white/50">{k}</span>
                      <select
                        value={axisMap[k]}
                        onChange={(e) => {
                          const next = { ...axisMap, [k]: Number(e.target.value) };
                          setAxisMap(next);
                          saveAxisMap(next);
                        }}
                        className="mt-1 w-full rounded bg-black/40 px-1 py-0.5 text-white"
                      >
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <option key={i} value={i}>
                            Axis {i}
                          </option>
                        ))}
                      </select>
                      <label className="mt-1 flex items-center gap-1 text-[10px] text-white/60">
                        <input
                          type="checkbox"
                          checked={axisMap[`inv${k[0]!.toUpperCase()}${k.slice(1)}` as keyof AxisMap] as boolean}
                          onChange={(e) => {
                            const key = `inv${k[0]!.toUpperCase()}${k.slice(1)}` as keyof AxisMap;
                            const next = { ...axisMap, [key]: e.target.checked };
                            setAxisMap(next);
                            saveAxisMap(next);
                          }}
                        />
                        ပြောင်းပြန်
                      </label>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-white/45">
                  Keyboard: W/S = throttle · A/D = yaw · Arrow keys = pitch/roll · Space = arm · R = respawn။ ဖုန်း/iPad: ဘယ် stick = throttle+yaw၊ ညာ stick = pitch+roll။
                </p>

                {/* ── တကယ့် radio / goggles ချိတ်နည်း ─────────────────── */}
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[12px] font-bold text-white/85">
                    📻 တကယ့် radio (ELRS · CRSF) နဲ့ ချိတ်နည်း
                  </div>
                  <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-white/60">
                    <li>
                      Radio ကို <b className="text-white/80">USB joystick mode</b> နဲ့ ဖွင့်ပါ —
                      EdgeTX/OpenTX radio (RadioMaster, Jumper, Radiomaster Pocket …) မှာ USB
                      ကြိုးထိုးလိုက်ရင် menu ပေါ်လာတယ်၊ <b>USB Joystick (HID)</b> ကို ရွေးပါ။
                    </li>
                    <li>
                      ELRS / Crossfire (TBS) module က <b>radio ↔ လေယာဉ်</b> ကြားက link ဖြစ်လို့
                      simulator အတွက် <b className="text-white/80">မလိုပါဘူး</b> — USB/Bluetooth က
                      radio ကနေ တိုက်ရိုက် stick တန်ဖိုးတွေ ယူတယ်။ တကယ့်လေယာဉ်နဲ့ လေ့ကျင့်တဲ့
                      အခါမှသာ ELRS/CRSF ကို bind လုပ်ပါ (packet rate 250Hz, model match ဖွင့်)။
                    </li>
                    <li>
                      Bluetooth ရှိတဲ့ radio (Pocket/Boxer/TX16S BT) ဆိုရင် phone/PC ရဲ့ Bluetooth
                      settings မှာ pair လုပ်ပြီး ဒီစာမျက်နှာ ပြန်ဖွင့်၊ stick တစ်ချက် လှုပ်ပါ။
                    </li>
                    <li>
                      အထက်က <b>Axis</b> dropdown တွေနဲ့ roll/pitch/throttle/yaw ကို ကိုက်အောင်
                      ရွေးပြီး လိုအပ်ရင် <b>ပြောင်းပြန်</b> ကို အမှန်ခြစ်ပါ — Mode 1/2/3/4 အားလုံး
                      ဒီနည်းနဲ့ ရတယ်။ ရွေးထားတာက device ထဲ မှတ်ထားပါတယ်။
                    </li>
                  </ol>

                  <div className="pt-1 text-[12px] font-bold text-white/85">🥽 Goggles နဲ့ ကြည့်နည်း</div>
                  <ul className="list-disc space-y-1.5 pl-4 text-[11px] leading-relaxed text-white/60">
                    <li>
                      Fatshark / Skyzone / Orqa စတဲ့ analog goggles မှာ{" "}
                      <b className="text-white/80">HDMI-in</b> ရှိရင် — PC ရဲ့ HDMI ကို goggles ထဲ
                      ထိုးပြီး ဒီ page ကို fullscreen (F11) လုပ်ပါ။ Goggles ရဲ့ HDMI mode ကို
                      ဖွင့်ရပါမယ်။
                    </li>
                    <li>
                      HDMI-in မရှိတဲ့ goggles ဆိုရင် — module bay ထဲ HDMI receiver module ထည့်ခြင်း၊
                      ဒါမှမဟုတ် ဖုန်းကို goggles ရဲ့ phone-slot (Fatshark-style) ထဲထည့်ပြီး ဒီ page
                      ကို ဖုန်းမှာ fullscreen ဖွင့်နိုင်ပါတယ်။
                    </li>
                    <li>
                      Digital system (HD goggles) တွေက sim video ကို တိုက်ရိုက် မလက်ခံပါ —
                      HDMI-in ရှိတဲ့ model ဖြစ်မှ ရပါမယ်။ မရှိရင် မျက်နှာပြင်နဲ့ပဲ လေ့ကျင့်ပါ၊
                      stick ခံစားချက်က တူညီပါတယ်။
                    </li>
                  </ul>
                  <p className="text-[10px] leading-snug text-white/35">
                    ★ ဒီ simulator က browser ထဲမှာ ပြေးလို့ radio ကို <b>USB/Bluetooth HID</b>{" "}
                    အနေနဲ့သာ ဖတ်နိုင်ပါတယ် — ELRS/CRSF ရဲ့ RF protocol ကို browser ကနေ
                    တိုက်ရိုက် မဖတ်နိုင်ပါ (hardware receiver လိုတယ်)。
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setMenu(false);
                setStarted(true);
              }}
              className="mt-4 w-full rounded-xl border border-emerald-400/60 bg-emerald-500/25 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/40"
            >
              ▶ ပျံမယ် — {FPV_MAPS.find((m) => m.id === prefs.map)?.nameMy} · {getDrone(prefs.drone).name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

