// soldier/SoldierController.js — FPS character controller (task 3.1)
// Flat ground + cylinder colliders push-out · stamina sprint · crouch height
import * as THREE from 'three';

export class SoldierController {
  constructor(collision) {
    this.col = collision;
    this.pos = new THREE.Vector3(2, 0, 8);   // feet position
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;                      // look
    this.pitch = 0;
    this.RADIUS = 0.35;
    this.EYE_STAND = 1.62;
    this.EYE_CROUCH = 1.05;
    this.eye = this.EYE_STAND;
    this.grounded = true;
    this.crouched = false;
    this.sprinting = false;
    this.stamina = 1;                        // 0..1
    this.SPEEDS = { walk: 4.2, sprint: 6.8, crouch: 1.8, air: 0.9 };
    this.moveSpeed = 0;                      // actual horizontal speed (anim/bob အတွက်)
    this.bobT = 0;
  }

  look(dx, dy, sens = 0.0022) {
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens, -1.45, 1.45);
  }

  // input: {x,z (-1..1 local), sprint, crouch, jump}
  update(dt, input) {
    // stamina
    const wantSprint = input.sprint && !this.crouched && input.z < -0.1; // ရှေ့သွားမှ sprint
    this.sprinting = wantSprint && this.stamina > 0.05;
    this.stamina = THREE.MathUtils.clamp(
      this.stamina + (this.sprinting ? -dt / 8 : dt / 5), 0, 1);

    // crouch (smooth eye height)
    this.crouched = input.crouch;
    const targetEye = this.crouched ? this.EYE_CROUCH : this.EYE_STAND;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 12);

    // horizontal movement (camera-yaw relative)
    const speed = this.crouched ? this.SPEEDS.crouch
      : this.sprinting ? this.SPEEDS.sprint : this.SPEEDS.walk;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = (input.x * cos - input.z * sin);
    let wz = (-input.x * sin - input.z * cos);
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const accel = this.grounded ? 14 : 2.5;
    this.vel.x += (wx * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wz * speed - this.vel.z) * Math.min(1, accel * dt);

    // jump + gravity
    if (input.jump && this.grounded) {
      this.vel.y = 4.6;
      this.grounded = false;
    }
    this.vel.y -= 12.5 * dt;                 // game gravity (snappy)

    // integrate
    this.pos.addScaledVector(this.vel, dt);

    // ground
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = true;
    }

    // cylinder colliders push-out (barrels/trees/gates)
    for (const c of this.col.cylinders) {
      if (this.pos.y > c.h) continue;
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
      const d = Math.hypot(dx, dz), minD = c.r + this.RADIUS;
      if (d < minD && d > 1e-4) {
        this.pos.x = c.x + dx / d * minD;
        this.pos.z = c.z + dz / d * minD;
      }
    }

    this.moveSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && this.moveSpeed > 0.3) this.bobT += dt * this.moveSpeed * 1.7;
  }

  // FPS camera pose (head bob ပါ)
  applyCamera(camera, adsWeight = 0) {
    const bobAmp = (1 - adsWeight * 0.8) * Math.min(1, this.moveSpeed / 4) * 0.03;
    const bobY = Math.abs(Math.sin(this.bobT)) * bobAmp;
    const bobX = Math.sin(this.bobT * 0.5) * bobAmp * 0.6;
    camera.position.set(
      this.pos.x + Math.cos(this.yaw) * bobX,
      this.pos.y + this.eye + bobY,
      this.pos.z - Math.sin(this.yaw) * bobX);
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
  }
}
