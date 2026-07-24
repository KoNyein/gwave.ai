// A dependency-free FPV drone simulator: a tiny pseudo-3D engine (Canvas 2D,
// no WebGL/Three.js) with rate/angle-mode quad physics and a gate course, so it
// builds anywhere and stays fully type-safe. Not photoreal like Liftoff, but a
// genuine 3D-perspective FPV racer you fly with a phone, gamepad, or a radio in
// USB-joystick mode.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Pilot inputs, each -1..1 except throttle 0..1. */
export interface Controls {
  throttle: number; // 0..1
  roll: number; // -1..1
  pitch: number; // -1..1 (stick forward = nose down)
  yaw: number; // -1..1
}

export type FlightMode = "angle" | "acro";

export interface Gate {
  pos: Vec3;
  yaw: number; // facing, radians
  radius: number;
}

export interface DroneState {
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  crashed: boolean;
}

export interface Track {
  name: string;
  gates: Gate[];
  start: Vec3;
}

const GRAVITY = 9.81;
const MAX_THRUST = 22; // m/s^2 at full throttle
const DRAG = 0.9; // per second
const MAX_RATE = 4.2; // rad/s (acro)
const MAX_ANGLE = 0.8; // rad (~46°) tilt limit in angle mode
const YAW_RATE = 2.6;

export function initDrone(t: Track): DroneState {
  return {
    pos: { ...t.start },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    crashed: false,
  };
}

/** Rotate a body vector into world space by the drone's yaw/pitch/roll. */
function bodyToWorld(s: DroneState, v: Vec3): Vec3 {
  // roll (z) → pitch (x) → yaw (y)
  const cr = Math.cos(s.roll),
    sr = Math.sin(s.roll);
  let x = v.x * cr - v.y * sr;
  let y = v.x * sr + v.y * cr;
  let z = v.z;
  const cp = Math.cos(s.pitch),
    sp = Math.sin(s.pitch);
  const y2 = y * cp - z * sp;
  const z2 = y * sp + z * cp;
  y = y2;
  z = z2;
  const cy = Math.cos(s.yaw),
    sy = Math.sin(s.yaw);
  const x2 = x * cy + z * sy;
  const z3 = -x * sy + z * cy;
  x = x2;
  z = z3;
  return { x, y, z };
}

/** Step the physics forward by dt seconds. */
export function step(
  s: DroneState,
  c: Controls,
  mode: FlightMode,
  dt: number,
): void {
  if (s.crashed) return;
  // Attitude.
  if (mode === "acro") {
    s.roll += c.roll * MAX_RATE * dt;
    s.pitch += c.pitch * MAX_RATE * dt;
  } else {
    // Angle mode: stick commands a target lean; ease toward it (self-levels).
    const targetRoll = c.roll * MAX_ANGLE;
    const targetPitch = c.pitch * MAX_ANGLE;
    s.roll += (targetRoll - s.roll) * Math.min(1, dt * 6);
    s.pitch += (targetPitch - s.pitch) * Math.min(1, dt * 6);
  }
  s.yaw += c.yaw * YAW_RATE * dt;

  // Thrust along the drone's up axis.
  const up = bodyToWorld(s, { x: 0, y: 1, z: 0 });
  const thrust = c.throttle * MAX_THRUST;
  s.vel.x += up.x * thrust * dt;
  s.vel.y += (up.y * thrust - GRAVITY) * dt;
  s.vel.z += up.z * thrust * dt;

  // Drag.
  const d = Math.max(0, 1 - DRAG * dt);
  s.vel.x *= d;
  s.vel.y *= d;
  s.vel.z *= d;

  // Integrate position.
  s.pos.x += s.vel.x * dt;
  s.pos.y += s.vel.y * dt;
  s.pos.z += s.vel.z * dt;

  // Ground.
  if (s.pos.y < 0.2) {
    s.pos.y = 0.2;
    const speed = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
    if (speed > 9) {
      s.crashed = true; // hard hit
    }
    s.vel.y = Math.max(0, s.vel.y);
    s.vel.x *= 0.6;
    s.vel.z *= 0.6;
  }
}

export function speed(s: DroneState): number {
  return Math.hypot(s.vel.x, s.vel.y, s.vel.z);
}

/** Did the drone pass through [g] this step (near its plane and inside radius)? */
export function passedGate(s: DroneState, prev: Vec3, g: Gate): boolean {
  // Gate normal from its yaw.
  const nx = Math.sin(g.yaw);
  const nz = Math.cos(g.yaw);
  const d0 = (prev.x - g.pos.x) * nx + (prev.z - g.pos.z) * nz;
  const d1 = (s.pos.x - g.pos.x) * nx + (s.pos.z - g.pos.z) * nz;
  if (Math.sign(d0) === Math.sign(d1)) return false; // didn't cross the plane
  // Crossing point roughly at current pos — check radius in the gate plane.
  const dx = s.pos.x - g.pos.x;
  const dy = s.pos.y - g.pos.y;
  const dz = s.pos.z - g.pos.z;
  // remove the normal component to get in-plane distance
  const along = dx * nx + dz * nz;
  const px = dx - along * nx;
  const pz = dz - along * nz;
  const inPlane = Math.hypot(px, dy, pz);
  return inPlane <= g.radius;
}

// ---- Rendering (Canvas 2D pseudo-3D) --------------------------------------

interface Cam {
  s: DroneState;
  tilt: number; // FPV camera up-tilt (rad)
}

/** Project a world point to screen; returns null if behind the camera. */
function project(
  cam: Cam,
  w: number,
  h: number,
  p: Vec3,
): { x: number; y: number; z: number } | null {
  const s = cam.s;
  // world → body (inverse of bodyToWorld: apply -yaw, -pitch(+tilt), -roll)
  let x = p.x - s.pos.x;
  let y = p.y - s.pos.y;
  let z = p.z - s.pos.z;
  // -yaw about y
  const cy = Math.cos(-s.yaw),
    sy = Math.sin(-s.yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  x = x1;
  z = z1;
  // -(pitch - tilt) about x
  const pAng = -(s.pitch - cam.tilt);
  const cp = Math.cos(pAng),
    sp = Math.sin(pAng);
  const y1 = y * cp - z * sp;
  const z2 = y * sp + z * cp;
  y = y1;
  z = z2;
  // -roll about z
  const cr = Math.cos(-s.roll),
    sr = Math.sin(-s.roll);
  const x2 = x * cr - y * sr;
  const y2 = x * sr + y * cr;
  x = x2;
  y = y2;
  if (z <= 0.3) return null;
  const f = h * 0.9; // focal length
  return { x: w / 2 + (f * x) / z, y: h / 2 - (f * y) / z, z };
}

export function render(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: DroneState,
  track: Track,
  nextGate: number,
): void {
  const cam: Cam = { s, tilt: 0.35 };

  // Sky + ground, banked by roll & pitch (fills the whole frame).
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1a2b";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(s.roll);
  const horizon = (s.pitch - cam.tilt) * h * 0.9;
  ctx.fillStyle = "#12324a"; // sky
  ctx.fillRect(-w, -h * 1.5 + horizon, w * 2, h * 1.5);
  ctx.fillStyle = "#0a1710"; // ground
  ctx.fillRect(-w, horizon, w * 2, h * 1.5);
  ctx.strokeStyle = "rgba(120,220,140,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w, horizon);
  ctx.lineTo(w, horizon);
  ctx.stroke();
  ctx.restore();

  // Ground grid.
  ctx.strokeStyle = "rgba(90,180,120,0.22)";
  ctx.lineWidth = 1;
  const gx = Math.round(s.pos.x / 10) * 10;
  const gz = Math.round(s.pos.z / 10) * 10;
  for (let i = -6; i <= 6; i++) {
    const a = project(cam, w, h, { x: gx + i * 10, y: 0, z: gz - 60 });
    const b = project(cam, w, h, { x: gx + i * 10, y: 0, z: gz + 60 });
    if (a && b) line(ctx, a, b);
    const c = project(cam, w, h, { x: gx - 60, y: 0, z: gz + i * 10 });
    const d = project(cam, w, h, { x: gx + 60, y: 0, z: gz + i * 10 });
    if (c && d) line(ctx, c, d);
  }

  // Gates (draw far → near).
  const order = track.gates
    .map((g, i) => ({ g, i, d: dist(g.pos, s.pos) }))
    .sort((a, b) => b.d - a.d);
  for (const { g, i } of order) {
    drawGate(ctx, cam, w, h, g, i === nextGate);
  }
}

function line(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function drawGate(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  w: number,
  h: number,
  g: Gate,
  isNext: boolean,
): void {
  const segs = 20;
  const nx = Math.cos(g.yaw); // in-plane right axis
  const nz = -Math.sin(g.yaw);
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k <= segs; k++) {
    const a = (k / segs) * Math.PI * 2;
    const rx = Math.cos(a) * g.radius;
    const ry = Math.sin(a) * g.radius;
    const p: Vec3 = {
      x: g.pos.x + rx * nx,
      y: g.pos.y + ry,
      z: g.pos.z + rx * nz,
    };
    const pr = project(cam, w, h, p);
    if (!pr) return; // partly behind camera — skip for simplicity
    pts.push(pr);
  }
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k]!.x, pts[k]!.y);
  ctx.closePath();
  ctx.lineWidth = isNext ? 6 : 3;
  ctx.strokeStyle = isNext ? "#39e67b" : "#f0b429";
  ctx.stroke();
  if (isNext) {
    ctx.fillStyle = "rgba(57,230,123,0.10)";
    ctx.fill();
  }
}

// ---- Tracks ---------------------------------------------------------------

export const TRACKS: Track[] = [
  {
    name: "Rookie Loop",
    start: { x: 0, y: 2, z: 0 },
    gates: ringCourse(6, 28, 3.2, 2.4),
  },
  {
    name: "Champions Circuit",
    start: { x: 0, y: 2, z: 0 },
    gates: ringCourse(9, 40, 2.6, 3.2),
  },
];

function ringCourse(
  n: number,
  radius: number,
  gateR: number,
  height: number,
): Gate[] {
  const gates: Gate[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.sin(a) * radius;
    const z = Math.cos(a) * radius;
    gates.push({
      pos: { x, y: height + Math.sin(a * 2) * 1.5, z },
      yaw: a + Math.PI / 2,
      radius: gateR,
    });
  }
  return gates;
}
