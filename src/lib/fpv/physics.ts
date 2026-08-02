/// FPV quad physics (Liftoff-style feel ကို ရည်ရွယ်တယ်)။
///
/// ★ Fixed-substep integration (240Hz) — frame rate မညီလည်း physics က
///   တူညီတဲ့ အပြုအမူပဲ ရမယ်။ dt ကြီးကြီးတစ်ခါတည်း integrate ရင်
///   drone က မတည်မငြိမ် ဖြစ်တတ်တယ် (esp. rate response)။
/// ★ Betaflight-style rates curve — တကယ့် FPV pilot တွေ သိတဲ့ ခံစားချက်:
///   center မှာ ညင်၊ stick အစွန်မှာ superRate က deg/s ကို ပြင်းပြင်းတက်။
/// ★ Angle mode (sport/cinematic) — stick = target tilt၊ P controller က
///   error ကို rate အဖြစ် ပြောင်းတယ်။ Acro မှာ stick = target rate တိုက်ရိုက်။

import * as THREE from "three";

import type { DroneSpec, FlightMode } from "./drones";
// ★ `.ts` extension က မဖြစ်မနေ — physics.test.ts က node ရဲ့ strip-types နဲ့
//   တိုက်ရိုက် ပြေးလို့ extensionless relative import ကို resolve မလုပ်နိုင်ဘူး။
//   (tsconfig မှာ allowImportingTsExtensions ဖွင့်ထားပြီးသား။)
import { getMode } from "./drones.ts";

const GRAVITY = 9.81;
const SUBSTEP = 1 / 240;
/// ဒီ speed (m/s) ထက် ပြင်းပြင်းတိုက်ရင် crash
const CRASH_SPEED = 6.5;

export type Sticks = {
  /// 0..1 (raw stick — throttle curve ကို ဒီထဲမှာ မလုပ်ရ)
  throttle: number;
  /// -1..1 (right = +)
  roll: number;
  /// -1..1 (forward/nose-down = +)
  pitch: number;
  /// -1..1 (right/clockwise = +)
  yaw: number;
};

export type DroneState = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  /// Body rates (rad/s) — roll(x), pitch(y→body z?), yaw
  rates: THREE.Vector3;
  armed: boolean;
  crashed: boolean;
  /// Crash ဖြစ်ချိန် impact speed (FX အတွက်)
  crashSpeed: number;
  /// ပျံသန်းချိန် (battery OSD)
  flightSec: number;
};

export function createState(spawn: THREE.Vector3, yaw: number): DroneState {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, "YXZ"));
  return {
    pos: spawn.clone(),
    vel: new THREE.Vector3(),
    quat: q,
    rates: new THREE.Vector3(),
    armed: false,
    crashed: false,
    crashSpeed: 0,
    flightSec: 0,
  };
}

/// Betaflight rates curve — stick (-1..1) → target rate (rad/s)
function rateCurve(x: number, rcRate: number, superRate: number, expo: number): number {
  const ax = Math.min(1, Math.abs(x));
  // expo — center ညင်အောင်
  const shaped = x * ax * ax * expo + x * (1 - expo);
  // base 200 deg/s @ rcRate 1 (betaflight convention)
  let rate = 200 * rcRate * shaped;
  // super rate — stick အစွန်မှာ ပြင်းပြင်းတက်
  rate /= 1 - ax * Math.min(0.95, superRate);
  return (rate * Math.PI) / 180;
}

export type Collider = { min: THREE.Vector3; max: THREE.Vector3 };

// ── လေအားပညာ / ဘက်ထရီ သဘောတရားများ ──────────────────────────────────────
//
// ★ အောက်က function တွေအားလုံးက **thrust ကို မြှောက်တဲ့ ကိန်း** တွေ ဖြစ်တယ်
//   (1 = ဘာမှ မပြောင်း)。 သီးခြားခွဲထားတာက စမ်းသပ်လို့ရအောင် — ဒါတွေဟာ
//   ပျံရတဲ့ ခံစားချက်ကို ဆုံးဖြတ်ပေမယ့် ဖန်သားပြင်ပေါ်မှာ တိုက်ရိုက် မမြင်ရဘူး။

/// 🔋 Battery sag — LiPo pack က အားကုန်လာလေ voltage နိမ့်လေ၊ throttle
/// ဖိထားချိန်မှာလည်း ချက်ချင်း voltage ကျတယ် (internal resistance)。
///
/// ★ ဒါက တကယ့် FPV မှာ အထင်ရှားဆုံး ခံစားချက်တစ်ခု — pack အသစ်နဲ့ punch
///   ကောင်းပေမယ့် နောက်ဆုံး တစ်မိနစ်မှာ တူညီတဲ့ stick နဲ့ မတက်တော့ဘူး။
export function batterySag(flightSec: number, drone: DroneSpec, thr: number): number {
  const used = Math.min(1, flightSec / Math.max(1, drone.batterySec));
  // အစပိုင်းမှာ ဖြောင့်ပြီး နောက်ပိုင်းမှာ ပိုကျတယ် (LiPo discharge curve)
  const depletion = 1 - 0.16 * used * used;
  // Load sag — ဖိလေ ကျလေ
  return depletion * (1 - 0.08 * Math.max(0, Math.min(1, thr)));
}

/// 🛬 Ground effect — မြေပြင်နားမှာ rotor ရဲ့ လေက ပြန်ခုန်တင်လို့ တွန်းအား
/// ပိုရတယ်။ တကယ့် IGE ratio: `T/T∞ = 1 / (1 - (R/4z)²)`。
///
/// ★ ဒါကြောင့် ဆင်းသက်ချိန် မြေနားရောက်ရင် "မွေ့ရာပေါ် ဆင်းသလို" ဖြစ်တယ် —
///   အဲဒါ မရှိရင် landing က ခက်လွန်းပြီး ဘာလို့လဲ ဆိုတာလည်း မသိရဘူး။
/// ★ Ducted (cinewhoop) မှာ ပိုသိသာတယ် — duct က လေကို ဘေးမထွက်အောင်
///   ပိတ်ထားလို့။
export function groundEffect(y: number, drone: DroneSpec): number {
  if (drone.craft === "plane") {
    // ✈️ Wing ground effect — အတောင်တစ်ခုစာ အမြင့်အောက်မှာ induced drag
    // ကျပြီး အပေါ်တင်အား တက်တယ် (landing မှာ "မျောနေတယ်" လို့ ခံစားရ)。
    const span = 2 * drone.scale;
    return y < span ? 1 + 0.1 * (1 - y / span) : 1;
  }
  const R = 0.3 * drone.scale;
  const z = Math.max(y, 0.02);
  if (z > 2 * R) return 1;
  const r = R / (4 * z);
  const cap = drone.ducted ? 1.24 : 1.18;
  return Math.min(cap, 1 / Math.max(0.2, 1 - r * r));
}

/// 🌀 Vortex ring state (settling with power) — ဒေါင်လိုက် ဆင်းနေရင်း
/// throttle ဖိထားရင် ကိုယ့် downwash ထဲ ကိုယ်ပြန်ဝင်ပြီး တွန်းအား ပျောက်တယ်။
///
/// ★ ရှေ့/ဘေးကို ရွေ့နေရင် အဲဒီ လေဝဲထဲက ထွက်သွားလို့ မဖြစ်ဘူး — ဒါကြောင့်
///   "ဆင်းနေရင် ရှေ့တိုးပါ" ဆိုတဲ့ တကယ့် နည်းလမ်းက ဒီမှာလည်း အလုပ်လုပ်တယ်။
export function vortexRing(vel: THREE.Vector3, drone: DroneSpec, thr: number): number {
  if (drone.craft === "plane" || thr < 0.2) return 1;
  const descent = -vel.y;
  const horiz = Math.hypot(vel.x, vel.z);
  if (descent < 2 || horiz > 4) return 1;
  const band = Math.min(1, (descent - 2) / 4); // 2..6 m/s ကြားမှာ ဆိုးဆိုးလာ
  return 1 - 0.22 * band * (1 - horiz / 4);
}

/// 💨 Translational lift + duct — ရှေ့ကို ရွေ့နေရင် rotor က လေစိမ်း ရလို့
/// ပိုထိရောက်တယ်။ Duct ကတော့ ရပ်နေချိန်မှာ တွန်းအား ပိုပေးပြီး အရှိန်မြင့်ရင်
/// အကျိုးမရှိတော့ဘူး (drag က spec ထဲမှာ ပိုများပြီးသား)。
export function airspeedFactor(vel: THREE.Vector3, drone: DroneSpec): number {
  if (drone.craft === "plane") return 1;
  const horiz = Math.hypot(vel.x, vel.z);
  let f = 1 + Math.min(0.09, horiz * 0.012);
  if (drone.ducted) f *= 1 + 0.1 * Math.max(0, 1 - vel.length() / 12);
  return f;
}

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _thrust = new THREE.Vector3();
const _drag = new THREE.Vector3();
const _dq = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _desired = new THREE.Quaternion();
const _qe = new THREE.Quaternion();
const _eulerD = new THREE.Euler();

/// Substep တစ်ခု
function step(
  s: DroneState,
  drone: DroneSpec,
  mode: FlightMode,
  st: Sticks,
  dt: number,
  colliders: Collider[],
) {
  const m = getMode(mode);

  // ── Target body rates (rad/s) ────────────────────────────────────────
  // Body axes: forward = -Z။ +X rotate = nose UP, -Y rotate = yaw right,
  // -Z rotate = roll right — sign တွေက ဒီ convention အတိုင်း တွက်ထားတယ်။
  // ✈️ Plane: control authority က airspeed နဲ့ လိုက်တယ် — ရပ်နေရင်
  //   elevator/aileron အလုပ်မလုပ်ဘူး (တကယ့် fixed-wing အတိုင်း)။
  _fwd.set(0, 0, -1).applyQuaternion(s.quat);
  const vFwd = s.vel.dot(_fwd);
  const authority =
    drone.craft === "plane" ? Math.min(1.3, Math.max(0, vFwd) / 12) : 1;
  const yawScale = drone.craft === "plane" ? 0.35 : 1; // rudder ညံ့တယ်
  const yawRate =
    rateCurve(st.yaw, drone.rcRate * 0.9, drone.superRate * 0.8, drone.expo) *
    m.rateScale *
    yawScale *
    authority;
  let tx: number;
  let ty = -yawRate;
  let tz: number;

  if (m.angle) {
    // Angle mode — stick = target tilt။ လက်ရှိ yaw ကို ထိန်းထားပြီး
    // desired orientation ဆောက်ကာ **quaternion error → rate** (P)။
    // Euler sign တွေကို လက်နဲ့ မလိုက်ရအောင် — error က body frame မှာ
    // တိုက်ရိုက် ထွက်လာလို့ axis မှားစရာ မရှိဘူး။
    _euler.setFromQuaternion(s.quat, "YXZ");
    const maxA = (drone.maxAngle * m.angleScale * Math.PI) / 180;
    _eulerD.set(-st.pitch * maxA, _euler.y, -st.roll * maxA, "YXZ");
    _desired.setFromEuler(_eulerD);
    _qe.copy(s.quat).invert().multiply(_desired);
    if (_qe.w < 0) {
      _qe.x = -_qe.x;
      _qe.y = -_qe.y;
      _qe.z = -_qe.z;
    }
    // ✈️ Angle mode မှာလည်း control authority က airspeed နဲ့ လိုက်ရမယ် —
    // မဟုတ်ရင် stall ဖြစ်နေတဲ့ လေယာဉ်က ထိန်းချုပ်မှု အပြည့် ရနေဦးမယ်။
    const P = 7 * authority;
    tx = 2 * _qe.x * P;
    ty += 2 * _qe.y * P;
    tz = 2 * _qe.z * P;
  } else {
    // Acro — stick = rate တိုက်ရိုက် (betaflight curve)
    const pitchRate = rateCurve(st.pitch, drone.rcRate, drone.superRate, drone.expo) * m.rateScale;
    const rollRate = rateCurve(st.roll, drone.rcRate, drone.superRate, drone.expo) * m.rateScale;
    tx = -pitchRate * authority; // stick ရှေ့ = nose down = -X
    tz = -rollRate * authority; // stick ညာ = roll right = -Z
  }

  // ✈️ Stall — stall speed အောက် နှေးသွားရင် နှာခေါင်း စိုက်ကျတယ်
  if (drone.craft === "plane" && s.pos.y > 1 && vFwd < (drone.stallSpeed ?? 8)) {
    tx -= 1.4;
  }

  // ── Rate response (first-order lag — မော်တာ/prop က ချက်ချင်း မလိုက်နိုင်)
  const k = 1 - Math.exp(-dt / drone.rateTau);
  s.rates.x += (tx - s.rates.x) * k;
  s.rates.y += (ty - s.rates.y) * k;
  s.rates.z += (tz - s.rates.z) * k;

  // ── Orientation integrate ────────────────────────────────────────────
  _dq.set(s.rates.x * dt * 0.5, s.rates.y * dt * 0.5, s.rates.z * dt * 0.5, 1).normalize();
  s.quat.multiply(_dq).normalize();

  // ── Forces ───────────────────────────────────────────────────────────
  // Throttle curve — အလယ်မှာ resolution များအောင် နည်းနည်း ကော့ထားတယ်
  const t = Math.max(0, Math.min(1, st.throttle));
  const thr = s.armed ? Math.pow(t, 1.35) : 0;
  _up.set(0, 1, 0).applyQuaternion(s.quat);

  // ★ Thrust ကို ပြောင်းလဲစေတဲ့ သဘောတရား ၄ ခု — pack အားကုန်မှု၊ မြေပြင်
  //   အနီး၊ ကိုယ့် downwash ထဲ ပြန်ဆင်းမှု၊ လေစီးမှု။ တစ်ခုချင်းကို အပေါ်မှာ
  //   သီးခြား export လုပ်ထားတယ် (test လုပ်လို့ရအောင်)。
  const envFactor =
    batterySag(s.flightSec, drone, t) *
    groundEffect(s.pos.y, drone) *
    vortexRing(s.vel, drone, thr) *
    airspeedFactor(s.vel, drone);

  if (drone.craft === "plane") {
    // ✈️ Fixed-wing — thrust က ရှေ့ကို၊ lift က airspeed² ကနေ body-up ကို
    // (ground effect က lift ဘက်မှာသာ သက်ရောက်တယ်၊ prop ဘက်မှာ မဟုတ်ဘူး)
    _thrust
      .copy(_fwd)
      .multiplyScalar((thr * drone.maxThrust * batterySag(s.flightSec, drone, t)) / drone.mass);
    const lift = Math.min(
      GRAVITY * 1.6,
      (drone.liftK ?? 0.07) * Math.max(0, vFwd) * Math.max(0, vFwd) * groundEffect(s.pos.y, drone),
    );
    s.vel.addScaledVector(_up, lift * dt);
  } else {
    // 🛸/🚁 Rotor — thrust က body-up။ Heli (collective-pitch) မှာ throttle
    // ~50% လောက်ဆို hover ဖြစ်အောင် curve ဖြောင့်ထားတယ် — quad ရဲ့
    // pow(1.35) curve ဆို hover point မြင့်လွန်းတယ်။
    const rotorThr = drone.craft === "heli" && s.armed ? t : thr;
    _thrust.copy(_up).multiplyScalar((rotorThr * drone.maxThrust * envFactor) / drone.mass);
  }

  // Drag — linear + quadratic
  const sp = s.vel.length();
  _drag.copy(s.vel).multiplyScalar(-(drone.dragLinear + drone.dragQuad * sp));

  s.vel.addScaledVector(_thrust, dt);
  s.vel.y -= GRAVITY * dt;
  s.vel.addScaledVector(_drag, dt);
  s.pos.addScaledVector(s.vel, dt);

  // ── မြေ / အဆောက်အအုံ တိုက်မိ ────────────────────────────────────────
  if (s.pos.y <= 0.06) {
    // ★ ✈️ လေယာဉ်က **ဘီးနဲ့ ပြေးတယ်** — ရှေ့အရှိန်က တိုက်မိမှု မဟုတ်ဘူး၊
    // ဒေါင်လိုက် အရှိန်ကိုသာ ယူတယ်။
    // (လက်ရှိ လေယာဉ် ၂ စီးမှာတော့ lift က 11-13 m/s မှာ မြေကနေ ခွာပေးလို့
    //  ရှေ့အရှိန် threshold ကို မြေပေါ်မှာ ဘယ်တော့မှ မမီဘူး — ဒါကြောင့် ဒါက
    //  ဖြစ်နေတဲ့ bug ကို ပြင်တာ မဟုတ်ဘဲ **liftK နိမ့်တဲ့ လေယာဉ် နောက်ထပ်
    //  ထည့်ရင် ဖြစ်လာမယ့်အရာကို ကြိုကာတာ**。 နှာစိုက်/စောင်းပြီး မြေကို
    //  တိုက်မိရင် ကျဆင်းအရှိန်ကြောင့် ဒေါင်လိုက်အရှိန် တက်လာလို့ crash က
    //  ဆက်ဖြစ်နေဆဲ — test မှာ ချည်ထားတယ်။)
    const impact =
      drone.craft === "plane"
        ? -s.vel.y
        : Math.max(-s.vel.y, Math.hypot(s.vel.x, s.vel.z) * 0.5);
    s.pos.y = 0.06;
    if (impact > CRASH_SPEED && s.armed) {
      s.crashed = true;
      s.crashSpeed = impact;
      s.armed = false;
    }
    // မြေပေါ်မှာ ပွတ်ဆွဲ — ✈️ လေယာဉ်က ဘီးနဲ့ ပြေးရမှာမို့ ပွတ်အား
    // အလွန်နည်း (မဟုတ်ရင် ဘယ်တော့မှ takeoff မရဘူး)。
    s.vel.y = Math.max(0, s.vel.y * -0.15);
    const roll = drone.craft === "plane" ? 0.999 : 0.92;
    s.vel.x *= roll;
    s.vel.z *= roll;
  }
  for (const c of colliders) {
    if (
      s.pos.x > c.min.x && s.pos.x < c.max.x &&
      s.pos.y > c.min.y && s.pos.y < c.max.y &&
      s.pos.z > c.min.z && s.pos.z < c.max.z
    ) {
      const impact = s.vel.length();
      if (impact > CRASH_SPEED && s.armed) {
        s.crashed = true;
        s.crashSpeed = impact;
        s.armed = false;
      }
      // အနီးဆုံး မျက်နှာပြင်ဘက် တွန်းထုတ် (AABB penetration အနည်းဆုံးဘက်)
      const dx = Math.min(s.pos.x - c.min.x, c.max.x - s.pos.x);
      const dy = Math.min(s.pos.y - c.min.y, c.max.y - s.pos.y);
      const dz = Math.min(s.pos.z - c.min.z, c.max.z - s.pos.z);
      if (dx <= dy && dx <= dz) {
        s.pos.x = s.pos.x - c.min.x < c.max.x - s.pos.x ? c.min.x : c.max.x;
        s.vel.x *= -0.25;
      } else if (dy <= dz) {
        s.pos.y = s.pos.y - c.min.y < c.max.y - s.pos.y ? c.min.y : c.max.y;
        s.vel.y *= -0.25;
      } else {
        s.pos.z = s.pos.z - c.min.z < c.max.z - s.pos.z ? c.min.z : c.max.z;
        s.vel.z *= -0.25;
      }
    }
  }

  if (s.armed) s.flightSec += dt;
}

/// Frame တစ်ခုစာ update — dt ကို substep တွေ ခွဲပြီး ပြေးတယ်။
export function updateDrone(
  s: DroneState,
  drone: DroneSpec,
  mode: FlightMode,
  st: Sticks,
  dt: number,
  colliders: Collider[],
) {
  let left = Math.min(dt, 0.1);
  while (left > 0) {
    const h = Math.min(SUBSTEP, left);
    step(s, drone, mode, st, h, colliders);
    left -= h;
  }
}

export function respawn(s: DroneState, spawn: THREE.Vector3, yaw: number) {
  s.pos.copy(spawn);
  s.vel.set(0, 0, 0);
  s.quat.setFromEuler(new THREE.Euler(0, yaw, 0, "YXZ"));
  s.rates.set(0, 0, 0);
  s.armed = false;
  s.crashed = false;
  s.flightSec = 0;
}

/// OSD အတွက် — km/h
export function speedKmh(s: DroneState): number {
  return s.vel.length() * 3.6;
}
