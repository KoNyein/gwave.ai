// DronePhysics.js — quaternion rigid-body FPV sim, 240Hz sub-stepped
// Body frame: +X right, +Y up, +Z back (three.js convention)
// pitch = rotation about X, yaw = about Y, roll = about Z
import * as THREE from 'three';

const DEG = Math.PI / 180;
const G = 9.81;

// ---- Betaflight "Actual Rates" curve (FeelFPV parity) ----
export function actualRate(x, { centerSens, maxRate, expo }) {
  const a = Math.abs(x);
  const curved = Math.pow(a, 5) * expo + a * (1 - expo);
  const stickMove = Math.max(0, maxRate - centerSens);
  return Math.sign(x) * (centerSens * a + stickMove * curved); // deg/s
}

class AxisPID {
  constructor(p, i, d, ff, iLimit = 120 * DEG) {
    Object.assign(this, { p, i, d, ff, iLimit });
    this.iTerm = 0; this.lastGyro = 0; this.lastSet = 0;
  }
  reset() { this.iTerm = 0; this.lastGyro = 0; this.lastSet = 0; }
  update(setpoint, gyro, dt) {
    const err = setpoint - gyro;
    // I-term relax: fast stick → freeze I (no bounce-back)
    if (Math.abs(setpoint) < 250 * DEG) {
      this.iTerm = THREE.MathUtils.clamp(this.iTerm + err * this.i * dt, -this.iLimit, this.iLimit);
    }
    const dGyro = (gyro - this.lastGyro) / dt;         // D on measurement
    const dSet  = (setpoint - this.lastSet) / dt;       // feed-forward
    this.lastGyro = gyro; this.lastSet = setpoint;
    return this.p * err + this.iTerm - this.d * dGyro + this.ff * dSet * 0.01;
  }
}

export class DronePhysics {
  constructor(cfg) {
    this.cfg = cfg;
    // --- spec (derived from config) ---
    this.armLen = 0.115;                 // m (5" frame half-diagonal)
    this.motorTau = 0.035;               // motor spool lag (s)
    this.dragLin = 0.32; this.dragQuad = 0.65;
    this.yawTorqueK = 0.012;             // prop reaction torque coeff
    this.idle = 0.055;                   // air-mode idle
    // --- state ---
    this.pos = new THREE.Vector3(0, 0.08, 0);
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.angVel = new THREE.Vector3();   // body frame, rad/s
    this.motors = [0, 0, 0, 0];          // [RR, FR, RL, FL]
    this.armed = false;
    this.crashed = false;
    this.voltage = 25.2; this.sagFilter = 0;
    this.flightTime = 0;
    // PIDs (rad-domain gains tuned for this inertia)
    this.pid = {
      roll:  new AxisPID(2.6, 3.2, 0.055, 1.0),
      pitch: new AxisPID(2.8, 3.4, 0.060, 1.0),
      yaw:   new AxisPID(3.4, 3.6, 0.0,   1.2),
    };
    this.levelP = 6.0;                   // ANGLE mode P
    this.maxAngle = 40 * DEG;
    this._tmp = { q: new THREE.Quaternion(), v: new THREE.Vector3(), e: new THREE.Euler() };
  }

  get massKg() { return this.cfg.massG / 1000; }
  get maxThrustN() {                     // total, scaled by throttle power %
    return this.massKg * G * 6.0 * (this.cfg.thrPower / 100); // TWR 6 baseline
  }
  inertia() {                            // scales with mass
    const s = this.massKg / 0.65;
    return { x: 0.0023 * s, y: 0.0040 * s, z: 0.0023 * s };
  }

  arm() {
    if (this.crashed) this.reset();
    this.armed = true;
  }
  disarm() { this.armed = false; this.motors = [0,0,0,0]; Object.values(this.pid).forEach(p => p.reset()); }
  reset(spawn = new THREE.Vector3(0, 0.08, 0)) {
    this.pos.copy(spawn); this.vel.set(0,0,0);
    this.quat.identity(); this.angVel.set(0,0,0);
    this.motors = [0,0,0,0]; this.crashed = false; this.armed = false;
    this.voltage = 25.2; this.flightTime = 0;
    Object.values(this.pid).forEach(p => p.reset());
  }

  // input: {throttle:0..1, pitch:-1..1, roll:-1..1, yaw:-1..1}
  step(dt, input) {
    if (!this.armed) { this._groundRest(dt); return; }
    this.flightTime += dt;
    const { q, v, e } = this._tmp;

    // ---- 1. setpoints ----
    let setRoll, setPitch, setYaw; // rad/s
    if (this.cfg.flightMode === 'ANGLE') {
      e.setFromQuaternion(this.quat, 'YXZ');           // yaw(Y), pitch(X), roll(Z)
      const tgtPitch = -input.pitch * this.maxAngle;
      const tgtRoll  = -input.roll  * this.maxAngle;
      setPitch = (tgtPitch - e.x) * this.levelP;
      setRoll  = (tgtRoll  - e.z) * this.levelP;
      setYaw   = actualRate(input.yaw, this.cfg.rates.yaw) * DEG;
    } else { // ACRO
      setPitch = actualRate(-input.pitch, this.cfg.rates.pitch) * DEG;
      setRoll  = actualRate(-input.roll,  this.cfg.rates.roll)  * DEG;
      setYaw   = actualRate( input.yaw,   this.cfg.rates.yaw)   * DEG;
    }

    // ---- 2. rate PID (gyro = body angVel) ----
    const outPitch = this.pid.pitch.update(setPitch, this.angVel.x, dt);
    const outYaw   = this.pid.yaw  .update(setYaw,   this.angVel.y, dt);
    const outRoll  = this.pid.roll .update(setRoll,  this.angVel.z, dt);

    // ---- 3. motor mixing (X config) + air mode ----
    const P = THREE.MathUtils.clamp(outPitch * 0.08, -0.6, 0.6);
    const R = THREE.MathUtils.clamp(outRoll  * 0.08, -0.6, 0.6);
    const Y = THREE.MathUtils.clamp(outYaw   * 0.08, -0.6, 0.6);
    let thr = input.throttle;
    let mix = [
      thr - P + R - Y,   // M1 RearRight  (CW)
      thr + P + R + Y,   // M2 FrontRight (CCW)
      thr - P - R + Y,   // M3 RearLeft   (CCW)
      thr + P - R - Y,   // M4 FrontLeft  (CW)
    ];
    // air-mode range shift (keep differential when clipping)
    const mx = Math.max(...mix), mn = Math.min(...mix);
    if (mx > 1) mix = mix.map(m => m - (mx - 1));
    if (mn < this.idle) mix = mix.map(m => m + (this.idle - Math.min(...mix)));
    mix = mix.map(m => THREE.MathUtils.clamp(m, this.idle, 1));

    // motor spool lag
    const k = 1 - Math.exp(-dt / this.motorTau);
    for (let i = 0; i < 4; i++) this.motors[i] += (mix[i] - this.motors[i]) * k;

    // ---- 4. battery sag ----
    const avg = (this.motors[0]+this.motors[1]+this.motors[2]+this.motors[3]) / 4;
    this.sagFilter += (avg - this.sagFilter) * dt * 3;
    const drain = this.flightTime / 240;                     // ~4min pack
    this.voltage = 25.2 - this.sagFilter * 2.6 - drain * 3.0;
    const vFactor = THREE.MathUtils.clamp(this.voltage / 25.2, 0.62, 1);

    // ---- 5. forces ----
    const perMotorMax = this.maxThrustN / 4;
    const thrusts = this.motors.map(m => m * m * perMotorMax * (1/(this.idle*this.idle+1)) * vFactor * 1.05);
    let totalT = thrusts[0] + thrusts[1] + thrusts[2] + thrusts[3];
    // ground effect
    if (this.pos.y < 0.6) totalT *= 1 + 0.12 * (1 - this.pos.y / 0.6);
    const bodyUp = v.set(0, 1, 0).applyQuaternion(this.quat);
    const upY = bodyUp.y;                       // unit-vector Y (before scaling!)
    const force = bodyUp.multiplyScalar(totalT);
    force.y -= this.massKg * G;
    // drag
    const spd = this.vel.length();
    if (spd > 0.001) {
      const drag = this.vel.clone().multiplyScalar(-(this.dragLin + this.dragQuad * spd) * 0.01 * this.massKg / 0.65);
      force.add(drag);
    }
    this.vel.addScaledVector(force, dt / this.massKg);
    this.pos.addScaledVector(this.vel, dt);

    // ---- 6. torques (Σ r × F + yaw reaction) ----
    const a = this.armLen * 0.707;
    // positions: RR(+a,+a) FR(+a,-a) RL(-a,+a) FL(-a,-a)  → (x, z)
    const px = [ a,  a, -a, -a], pz = [ a, -a,  a, -a];
    const spin = [ 1, -1, -1,  1]; // CW=+1
    let tx = 0, ty = 0, tz = 0;
    for (let i = 0; i < 4; i++) {
      tx += -pz[i] * thrusts[i];              // pitch torque
      tz +=  px[i] * thrusts[i] * -1;         // roll torque (right motors up → roll left correction sign)
      ty += spin[i] * thrusts[i] * this.yawTorqueK / 0.02;
    }
    tz = -tz; // align with mixer sign convention
    // prop-wash turbulence: fast descent into own wake
    const descending = this.vel.y < -4 && upY > 0.85;
    if (descending) {
      tx += (Math.random()-0.5) * 0.35; tz += (Math.random()-0.5) * 0.35;
    }
    const I = this.inertia();
    this.angVel.x += (tx / I.x) * dt;
    this.angVel.y += (ty / I.y) * dt;
    this.angVel.z += (tz / I.z) * dt;
    // rotational damping
    this.angVel.multiplyScalar(1 - Math.min(1, 2.2 * dt));

    // integrate quaternion: dq = 0.5 * q * ω
    const w = this.angVel;
    q.set(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 1).normalize();
    this.quat.multiply(q).normalize();

    // ---- 7. ground collision ----
    if (this.pos.y < 0.08) {
      const impact = -this.vel.y;
      this.pos.y = 0.08;
      if (impact > 6 || upY < 0.3) {        // hard crash / upside down
        this.crashed = true; this.disarm();
      } else {
        this.vel.y = Math.max(0, this.vel.y);
        this.vel.x *= 0.85; this.vel.z *= 0.85;  // ground friction
      }
    }
  }

  _groundRest(dt) {
    if (this.pos.y > 0.08) {                      // fall when disarmed
      this.vel.y -= G * dt;
      this.pos.addScaledVector(this.vel, dt);
      if (this.pos.y <= 0.08) { this.pos.y = 0.08; this.vel.set(0,0,0); }
    }
  }

  // telemetry
  get altitude() { return Math.max(0, this.pos.y - 0.08); }
  get speedKmh() { return this.vel.length() * 3.6; }
  get rollDeg()  {
    this._tmp.e.setFromQuaternion(this.quat, 'YXZ');
    return this._tmp.e.z / DEG;
  }
  get pitchDeg() {
    this._tmp.e.setFromQuaternion(this.quat, 'YXZ');
    return this._tmp.e.x / DEG;
  }
}
