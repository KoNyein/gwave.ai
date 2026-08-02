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
import {
  CAL_PROMPT,
  CHANNEL_ORDERS,
  STICK_MODES,
  createCalibrator,
  presetMap,
  type CalProgress,
  type ChannelOrder,
} from "@/lib/fpv/calibration";
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
/// `view` — fpv = ကင်မရာက drone ထဲမှာ၊ chase = အပြင်ကနေ drone ကို မြင်ရတယ်
type Prefs = { drone: string; mode: FlightMode; map: string; sound: boolean; game: string; view: "fpv" | "chase" };
function loadPrefs(): Prefs {
  const def: Prefs = { drone: "raptor5", mode: "sport", map: "race", sound: true, game: "free", view: "fpv" };
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
function buildPlaneMesh(spec: DroneSpec): { group: THREE.Group; props: THREE.Object3D[] } {
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
function buildHeliMesh(spec: DroneSpec): { group: THREE.Group; props: THREE.Object3D[] } {
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
function buildCraftMesh(spec: DroneSpec): { group: THREE.Group; props: THREE.Object3D[] } {
  if (spec.craft === "plane") return buildPlaneMesh(spec);
  if (spec.craft === "heli") return buildHeliMesh(spec);
  return buildDroneMesh(spec);
}

/// 🛸 Drone 3D model — တကယ့် FPV quad တစ်စီးရဲ့ အစိတ်အပိုင်းတွေအတိုင်း
/// procedural ဆွဲထားတယ် (asset file မလို)။
///
/// ★ ဖွဲ့စည်းပုံက တကယ့် build တစ်ခုအတိုင်း — carbon plate၊ standoff၊ FC stack၊
///   arm ၄ ချောင်း၊ motor bell + stator၊ tri-blade prop၊ LiPo + strap၊
///   ရှေ့မှာ cam ကို `camTilt` ထောင့်အတိုင်း စောင်းတပ်၊ နောက်မှာ VTX antenna၊
///   အောက်မှာ LED strip။
/// ★ `ducted` drone (Avata ပုံစံ) ဆိုရင် prop တိုင်းကို duct ring နဲ့ ဝိုင်းတယ်
///   — ကြည့်ရုံနဲ့ ဘယ်ဟာက ducted လဲ သိစေဖို့။
function buildDroneMesh(spec: DroneSpec): { group: THREE.Group; props: THREE.Object3D[] } {
  const g = new THREE.Group();
  const s = spec.scale;
  const carbon = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.45, metalness: 0.25 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.4, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.7 });

  // ── Frame — carbon plate နှစ်ချပ်ကို standoff နဲ့ ခံထား ─────────────────
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.012 * s, 0.3 * s), carbon);
  g.add(bottom);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.01 * s, 0.24 * s), carbon);
  top.position.y = 0.075 * s;
  g.add(top);
  for (const [x, z] of [[-0.06, -0.1], [0.06, -0.1], [-0.06, 0.1], [0.06, 0.1]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.007 * s, 0.007 * s, 0.075 * s, 6), bodyMat);
    post.position.set(x * s, 0.038 * s, z * s);
    g.add(post);
  }
  // FC / ESC stack — plate နှစ်ချပ်ကြားက အစိမ်းရောင် PCB
  const stack = new THREE.Mesh(
    new THREE.BoxGeometry(0.07 * s, 0.035 * s, 0.07 * s),
    new THREE.MeshStandardMaterial({ color: 0x1d5c3a, roughness: 0.6 }),
  );
  stack.position.y = 0.035 * s;
  g.add(stack);

  // ── Arm ၄ ချောင်း — motor ဆီ ထောင့်ဖြတ် ထွက်သွားတယ် ────────────────────
  const armLen = 0.2 * s;
  for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.014 * s, 0.036 * s), carbon);
    arm.position.set((ax * armLen) / 2, 0.004 * s, (az * armLen) / 2);
    arm.rotation.y = -Math.atan2(az, ax);
    g.add(arm);
  }

  // ── Motor + prop ၄ လုံး ────────────────────────────────────────────────
  const props: THREE.Object3D[] = [];
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xe8ecf2,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  // မြန်မြန်လှည့်ရင် blade တစ်ခုချင်း မမြင်ရတော့ဘဲ ဝိုင်းလုံးလို ဖြစ်တယ် —
  // အဲဒါကို ဖော်ဖို့ ဖျော့ဖျော့ disc တစ်ခု ထပ်ထားတယ်။
  const discMat = new THREE.MeshStandardMaterial({
    color: 0xc8d2e0,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const propR = (spec.ducted ? 0.115 : 0.125) * s;
  for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const mx = px * 0.145 * s;
    const mz = pz * 0.145 * s;
    // Motor bell (အပြင်လှည့်တဲ့အပိုင်း) + အောက်က stator
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.032 * s, 0.03 * s, 12), bodyMat);
    bell.position.set(mx, 0.028 * s, mz);
    g.add(bell);
    const stator = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * s, 0.028 * s, 0.016 * s, 10), darkMat);
    stator.position.set(mx, 0.012 * s, mz);
    g.add(stator);

    // Prop — hub + tri-blade။ Group ကို x=-90° လှည့်ထားလို့ local z က
    // အပေါ်ဘက် — animate loop က `rotation.z` တိုးရုံနဲ့ လှည့်တယ်။
    const prop = new THREE.Group();
    prop.rotation.x = -Math.PI / 2;
    prop.position.set(mx, 0.05 * s, mz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.012 * s, 8), darkMat);
    hub.rotation.x = Math.PI / 2;
    prop.add(hub);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(propR, propR * 0.34, 0.004 * s), bladeMat);
      blade.position.set(propR / 2, 0, 0);
      // Blade pitch — prop က ပြားနေတာ မဟုတ်ဘူး၊ စောင်းထားလို့ လေတွန်းတယ်
      blade.rotation.x = 0.28;
      const hold = new THREE.Group();
      hold.rotation.z = (b / 3) * Math.PI * 2;
      hold.add(blade);
      prop.add(hold);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(propR, 18), discMat);
    prop.add(disc);
    g.add(prop);
    props.push(prop);

    if (spec.ducted) {
      const duct = new THREE.Mesh(
        new THREE.TorusGeometry(propR * 1.06, 0.012 * s, 6, 20),
        new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.5 }),
      );
      duct.rotation.x = -Math.PI / 2;
      duct.position.set(mx, 0.05 * s, mz);
      g.add(duct);
    }
  }

  // ── LiPo battery — အပေါ်ပြားပေါ်တင်ပြီး strap နဲ့ ချည် ──────────────────
  const batt = new THREE.Mesh(
    new THREE.BoxGeometry(0.1 * s, 0.05 * s, 0.17 * s),
    new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.85 }),
  );
  batt.position.set(0, 0.105 * s, 0.02 * s);
  g.add(batt);
  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.115 * s, 0.058 * s, 0.02 * s),
    new THREE.MeshStandardMaterial({ color: 0xd94f4f, roughness: 0.9 }),
  );
  strap.position.set(0, 0.105 * s, 0.02 * s);
  g.add(strap);

  // ── FPV camera — `camTilt` ထောင့်အတိုင်း စောင်းတပ် ─────────────────────
  const cam = new THREE.Group();
  cam.position.set(0, 0.055 * s, -0.115 * s);
  cam.rotation.x = THREE.MathUtils.degToRad(spec.camTilt);
  cam.add(new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.05 * s, 0.045 * s), darkMat));
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018 * s, 0.02 * s, 0.022 * s, 10),
    new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.15, metalness: 0.6 }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.032 * s;
  cam.add(lens);
  g.add(cam);
  // Canopy — cam ကို ဖုံးထားတဲ့ 3D-print အဖုံး
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.062 * s, 0.045 * s, 0.075 * s), bodyMat);
  canopy.position.set(0, 0.058 * s, -0.09 * s);
  g.add(canopy);

  // ── VTX antenna — နောက်ဘက် စောင်းထောင် (pagoda cap နဲ့) ────────────────
  const ant = new THREE.Group();
  ant.position.set(0, 0.085 * s, 0.14 * s);
  ant.rotation.x = -0.5;
  const antRod = new THREE.Mesh(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.09 * s, 6), darkMat);
  antRod.position.y = 0.045 * s;
  ant.add(antRod);
  const antCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017 * s, 0.017 * s, 0.03 * s, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2b23a, roughness: 0.5 }),
  );
  antCap.position.y = 0.105 * s;
  ant.add(antCap);
  g.add(ant);

  // ── LED strip — arm အောက်မှာ။ အမှောင်ထဲ drone ကို မြင်ရစေတယ် ──────────
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x35f0a0,
    emissive: 0x35f0a0,
    emissiveIntensity: 1.4,
    roughness: 1,
  });
  for (const lx of [-1, 1]) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.012 * s, 0.006 * s, 0.13 * s), ledMat);
    led.position.set(lx * 0.075 * s, -0.008 * s, 0.05 * s);
    g.add(led);
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
  /// Auto-calibration wizard — `null` = မဖွင့်ထားဘူး
  const [cal, setCal] = useState<CalProgress | null>(null);
  const [calRunning, setCalRunning] = useState(false);
  const [calWarn, setCalWarn] = useState<string | null>(null);
  const calRef = useRef<ReturnType<typeof createCalibrator> | null>(null);
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
  const viewRef = useRef<Prefs["view"]>("fpv");
  const soundRef = useRef(true);
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

  // ★ `view` နဲ့ `sound` က ပျံနေတုန်း ပြောင်းလို့ရရမယ့် setting တွေ —
  //   scene effect ရဲ့ dependency ထဲ မထည့်ဘူး။ ထည့်ရင် ခလုပ်နှိပ်တိုင်း
  //   sim တစ်ခုလုံး rebuild ဖြစ်ပြီး ပျံနေတဲ့ drone က spawn ကို ပြန်ရောက်တယ်။
  if (prefs) {
    viewRef.current = prefs.view;
    soundRef.current = prefs.sound;
  }

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

  // ── 🎛 Auto-calibration wizard ──────────────────────────────────────────
  //
  // ★ Radio ကို ဒီမှာ ချိတ်ပြီး တကယ် လှုပ်ကြည့်မှ ဘယ် axis က ဘာလဲ သိတယ် —
  //   preset ၄ မျိုးက radio အားလုံးကို မခြုံဘူး (firmware/Bluetooth stack
  //   အလိုက် axis တွေ နေရာပြောင်းတတ်တယ်)。
  // ★ Loop က `calRunning` boolean ပေါ်မှာသာ မှီတယ် — progress state ပေါ်
  //   မှီရင် frame တိုင်း effect ပြန်စလို့ rAF က အမြဲ ပြန်ဖျက်ခံရမယ်။
  useEffect(() => {
    if (!calRunning) return;
    const pad = () => {
      const list = navigator.getGamepads?.() ?? [];
      return Array.from(list).find((g) => g && g.axes.length >= 4) ?? null;
    };
    if (!pad()) {
      setCalWarn("Controller မတွေ့ပါ — radio ကို ချိတ်ပြီး stick တစ်ချက် လှုပ်ပါ။");
      setCalRunning(false);
      return;
    }
    const c = calRef.current;
    if (!c) return;
    let raf = 0;
    const tick = () => {
      const g = pad();
      if (g) {
        const p = c.sample(g.axes);
        setCal(p);
        if (p.step === "done") {
          if (!c.complete()) {
            setCalWarn(
              "Stick တစ်ချို့ လှုပ်တာ မတွေ့ပါ — မတွေ့တဲ့ function တွေက အရင်အတိုင်း ကျန်ပါမယ်။",
            );
          } else {
            const bad = c.conflicts();
            setCalWarn(
              bad.length
                ? `Stick တစ်ခုတည်းကို နှစ်ခါ လှုပ်မိပုံရတယ် (${bad.join(", ")}) — ပြန်ချိန်ပါ။`
                : null,
            );
          }
          setCalRunning(false);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [calRunning]);

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
    // FPV view မှာ ဖျောက်ထား၊ chase view မှာ ပြန်ပြ — animate loop က
    // frame တိုင်း `viewRef` အလိုက် ပြန်သတ်မှတ်တယ်။
    droneMesh.visible = viewRef.current === "chase";
    // Chase camera — yaw လိုက်တဲ့ တန်ဖိုးနဲ့ offset vector
    let chaseYaw = map.spawnYaw;
    const chaseOff = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
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

      // ── ကင်မရာ ─────────────────────────────────────────────────────────
      const m = getMode(modeRef.current);
      if (viewRef.current === "chase") {
        // 🎥 Chase (3rd person) — drone ကို အပြင်ကနေ မြင်ရတယ်။
        // ★ Drone ရဲ့ quaternion အပြည့် လိုက်ရင် flip/roll လုပ်တိုင်း ကင်မရာ
        //   လိုက်လှည့်လို့ ခေါင်းမူးတယ် — ဒါကြောင့် **yaw တစ်ခုတည်း** ကိုပဲ
        //   လိုက်ပြီး အဲဒါကိုတောင် နှေးနှေး lerp လုပ်တယ်။
        droneMesh.visible = true;
        const e = new THREE.Euler().setFromQuaternion(state.quat, "YXZ");
        let dy = e.y - chaseYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        chaseYaw += dy * Math.min(1, 5 * dt);
        chaseOff.set(0, 0.5 + 0.35 * drone.scale, 1.5 + 1.5 * drone.scale);
        chaseOff.applyAxisAngle(UP, chaseYaw);
        camera.position.copy(state.pos).add(chaseOff);
        camera.lookAt(state.pos.x, state.pos.y + 0.15 * drone.scale, state.pos.z);
      } else {
        // FPV — ကင်မရာက drone ထဲမှာ၊ cam tilt ထောင့်အတိုင်း
        droneMesh.visible = false;
        camQ.copy(state.quat).multiply(camTiltQ);
        if (m.camSmooth > 0) camera.quaternion.slerp(camQ, 1 - Math.pow(m.camSmooth, dt * 60));
        else camera.quaternion.copy(camQ);
        camera.position.copy(state.pos);
      }

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

      sound.update(sticks.throttle, state.armed, !soundRef.current);

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
    // ★ `prefs` အပြည့်ကို dep မထည့်ဘူး — sound/view ခလုပ်နှိပ်တိုင်း scene
    //   တစ်ခုလုံး rebuild ဖြစ်ပြီး ပျံနေတဲ့ drone က spawn ကို ပြန်ရောက်တယ်။
    //   အဲဒီနှစ်ခုကို ref ကနေ ဖတ်ထားပြီး ကျန် field တွေကိုပဲ dep ထားတယ်။
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, prefs?.drone, prefs?.mode, prefs?.map, prefs?.game, axisMap, runNonce]);

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
              onClick={() => {
                const view = prefs.view === "fpv" ? "chase" : "fpv";
                viewRef.current = view;
                save({ ...prefs, view });
              }}
              title="ကင်မရာ — FPV / အပြင်ကနေ"
            >
              {prefs.view === "fpv" ? "🥽 FPV" : "🎥 3rd"}
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
                        <span className="text-sm font-bold">
                          {d.name}
                          {d.ducted && <span className="ml-1 text-[10px] text-sky-300">◎ ducted</span>}
                        </span>
                        <span className="shrink-0 rounded bg-white/10 px-1.5 text-[10px] text-white/60">
                          {d.cls} · {d.size}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-white/55">{d.blurbMy}</div>
                      <div className="mt-1 text-[10px] text-white/40">
                        {Math.round(d.mass * 1000)}g · T/W {(d.maxThrust / (d.mass * 9.81)).toFixed(1)} · cam {d.camTilt}°
                        {d.craft === "plane" && ` · stall ${d.stallSpeed} m/s`}
                      </div>
                      {d.specNote && (
                        <div className="mt-1 text-[10px] leading-snug text-amber-200/60">ℹ️ {d.specNote}</div>
                      )}
                    </button>
                  ))}
                </div>

                {/* ★ တကယ်ရှိတဲ့ ကိရိယာနာမည် သုံးထားတဲ့ model တွေအတွက် —
                    ဘယ်သူပိုင်တာလဲ ရှင်းရှင်းပြောဖို့ လိုတယ် (nominative use)။ */}
                {DRONES.some((d) => d.craft === craft && d.reference) && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[10px] leading-relaxed text-amber-100/60">
                    📷 <b>Reference model</b> — အထက်က တကယ်ရှိတဲ့ ကိရိယာနာမည်တွေက
                    သက်ဆိုင်ရာ ပိုင်ရှင်တွေရဲ့ trademark တွေ ဖြစ်ပြီး Gwave နဲ့
                    ဆက်စပ်မှု၊ ထောက်ခံမှု မရှိပါဘူး။ ဘယ်ပျံသန်းမှုပုံစံကို
                    တုပထားလဲ ဖော်ပြဖို့သာ သုံးထားတာပါ။ ဂဏန်းတွေက ထုတ်လုပ်သူ
                    ကြေညာချက်အတိုင်း — ခန့်မှန်းထားတာဆိုရင် အထက်မှာ ℹ️ နဲ့
                    မှတ်ထားပါတယ်။
                  </div>
                )}

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
                {/* ── 🎛 Auto calibration ────────────────────────────────
                    ★ Preset က radio အားလုံးကို မခြုံဘူး — firmware/Bluetooth
                      stack အလိုက် axis နေရာ ပြောင်းတတ်တယ်။ တကယ် လှုပ်ကြည့်တာက
                      ဟာ့ဒ်ဝဲကို မမှားနိုင်တဲ့ တစ်ခုတည်းသော နည်းလမ်း။ */}
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-white/85">
                      🎛 အလိုအလျောက် ချိန်ညှိခြင်း
                    </span>
                    {!calRunning && (
                      <button
                        onClick={() => {
                          const pads = navigator.getGamepads?.() ?? [];
                          const g = Array.from(pads).find((x) => x && x.axes.length >= 4);
                          const c = createCalibrator(g?.axes.length ?? 4);
                          c.start();
                          calRef.current = c;
                          setCal({ step: "center", progress: 0, detectedAxis: null, detectedInvert: false });
                          setCalWarn(null);
                          setCalRunning(true);
                        }}
                        className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                      >
                        စတင်မယ်
                      </button>
                    )}
                  </div>

                  {cal && cal.step !== "idle" ? (
                    <>
                      <div className="text-[12px] leading-snug text-white/85">
                        {CAL_PROMPT[cal.step].my}
                      </div>
                      <div className="text-[10px] text-white/40">{CAL_PROMPT[cal.step].en}</div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-[width]"
                          style={{ width: `${Math.round(cal.progress * 100)}%` }}
                        />
                      </div>
                      {cal.detectedAxis !== null && (
                        <div className="text-[10px] text-emerald-300/70">
                          Axis {cal.detectedAxis} လှုပ်နေတယ်
                          {cal.detectedInvert && " (ပြောင်းပြန်)"}
                        </div>
                      )}
                      {cal.step === "done" && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              const c = calRef.current;
                              if (!c) return;
                              const next = c.result(axisMap);
                              setAxisMap(next);
                              saveAxisMap(next);
                              setCal(null);
                            }}
                            className="rounded-lg bg-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/35"
                          >
                            ✓ သိမ်းမယ်
                          </button>
                          <button
                            onClick={() => {
                              setCal(null);
                              setCalWarn(null);
                            }}
                            className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/20"
                          >
                            မသိမ်းဘူး
                          </button>
                        </div>
                      )}
                      {calRunning && (
                        <button
                          onClick={() => {
                            calRef.current?.cancel();
                            setCalRunning(false);
                            setCal(null);
                          }}
                          className="text-[10px] text-white/40 underline underline-offset-2 hover:text-white/70"
                        >
                          ရပ်မယ်
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] leading-snug text-white/50">
                      Radio ချိတ်ပြီး ခလုပ်နှိပ်ပါ — stick တွေကို အဆုံးထိ လှုပ်ခိုင်းပြီး ဘယ်
                      axis က ဘာလဲ၊ ပြောင်းပြန်လား၊ အဆုံးထိ ဘယ်လောက်ရောက်လဲ ဆိုတာ
                      တိုင်းပါမယ်။ Stick အလယ်မှာ မငြိမ်တဲ့ radio ဆိုရင် deadband ကို
                      အလိုအလျောက် ချဲ့ပေးပါတယ်။
                    </p>
                  )}

                  {calWarn && (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[10px] leading-snug text-amber-100">
                      ⚠️ {calWarn}
                    </div>
                  )}
                </div>

                {/* ── Channel order preset ──────────────────────────────
                    ★ ချိန်ညှိလို့ မရတဲ့အခါ (radio မချိတ်ရသေးဘူး) အတွက်
                      စံ ၄ မျိုး — EdgeTX က AETR၊ Spektrum က TAER。 */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[12px] font-bold text-white/85">📻 Channel order</div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {(Object.keys(CHANNEL_ORDERS) as ChannelOrder[]).map((o) => (
                      <button
                        key={o}
                        onClick={() => {
                          // ★ Preset က axis နေရာပဲ ပြောင်းတယ် — ချိန်ညှိထားတဲ့
                          //   endpoint/deadband ကို မဖျက်ဘူး။
                          const next = { ...presetMap(o), cal: axisMap.cal };
                          setAxisMap(next);
                          saveAxisMap(next);
                        }}
                        className={`rounded-lg px-2 py-1.5 text-[11px] transition ${
                          axisMap.preset === o
                            ? "bg-emerald-500/25 text-emerald-200"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[10px] leading-snug text-white/45">
                    {
                      CHANNEL_ORDERS[
                        (axisMap.preset === "custom" ? "AETR" : axisMap.preset) as ChannelOrder
                      ].radios
                    }
                    {axisMap.preset === "custom" && " · လက်ရှိက ကိုယ်တိုင်ချိန်ထားတာ"}
                  </div>
                </div>

                {/* ── Stick mode — radio ဘက်က setting၊ sim က ပြောင်းလို့မရဘူး */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[12px] font-bold text-white/85">🕹 Stick mode</div>
                  <div className="mt-1.5 space-y-1 text-[10px] leading-snug text-white/50">
                    {Object.entries(STICK_MODES).map(([n, m]) => (
                      <div key={n}>
                        <b className="text-white/70">Mode {n}</b> — ဘယ်: {m.left} · ညာ: {m.right}
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] leading-snug text-white/40">
                    ★ Stick mode က <b>radio ထဲက setting</b> ပါ — sim ကနေ ပြောင်းလို့ မရပါ။
                    ကိုယ့် radio က ဘယ် mode လဲ ဆိုတာ အထက်က ချိန်ညှိမှုက အလိုအလျောက်
                    လိုက်ပါမယ်။
                  </p>
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

