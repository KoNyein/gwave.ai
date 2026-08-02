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
import { getMode } from "./drones";

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

const _up = new THREE.Vector3();
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
  const yawRate = rateCurve(st.yaw, drone.rcRate * 0.9, drone.superRate * 0.8, drone.expo) * m.rateScale;
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
    const P = 7;
    tx = 2 * _qe.x * P;
    ty += 2 * _qe.y * P;
    tz = 2 * _qe.z * P;
  } else {
    // Acro — stick = rate တိုက်ရိုက် (betaflight curve)
    const pitchRate = rateCurve(st.pitch, drone.rcRate, drone.superRate, drone.expo) * m.rateScale;
    const rollRate = rateCurve(st.roll, drone.rcRate, drone.superRate, drone.expo) * m.rateScale;
    tx = -pitchRate; // stick ရှေ့ = nose down = -X
    tz = -rollRate; // stick ညာ = roll right = -Z
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
  _thrust.copy(_up).multiplyScalar((thr * drone.maxThrust) / drone.mass);

  // Drag — linear + quadratic
  const sp = s.vel.length();
  _drag.copy(s.vel).multiplyScalar(-(drone.dragLinear + drone.dragQuad * sp));

  s.vel.addScaledVector(_thrust, dt);
  s.vel.y -= GRAVITY * dt;
  s.vel.addScaledVector(_drag, dt);
  s.pos.addScaledVector(s.vel, dt);

  // ── မြေ / အဆောက်အအုံ တိုက်မိ ────────────────────────────────────────
  if (s.pos.y <= 0.06) {
    const impact = Math.max(-s.vel.y, Math.hypot(s.vel.x, s.vel.z) * 0.5);
    s.pos.y = 0.06;
    if (impact > CRASH_SPEED && s.armed) {
      s.crashed = true;
      s.crashSpeed = impact;
      s.armed = false;
    }
    // မြေပေါ်မှာ ပွတ်ဆွဲ
    s.vel.y = Math.max(0, s.vel.y * -0.15);
    s.vel.x *= 0.92;
    s.vel.z *= 0.92;
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
