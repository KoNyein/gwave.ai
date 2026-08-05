// race/CollisionSystem.js — simple cylinder colliders vs drone sphere (task 2.2)
// Rapier မလိုသေး — barrels/trees/gate posts လုံလောက် · P3 မှာ Rapier ကူးမည်
export class CollisionSystem {
  constructor() {
    this.cylinders = [];   // {x, z, r, h}
    this.DRONE_R = 0.13;
    this.CRASH_SPEED = 3.5; // m/s ကျော်တိုက်ရင် crash
  }
  addCylinder(x, z, r, h) { this.cylinders.push({ x, z, r, h }); }

  // physics step ပြီးတိုင်းခေါ် — return 'crash' | 'bump' | null
  check(physics) {
    const p = physics.pos, v = physics.vel;
    for (const c of this.cylinders) {
      if (p.y - this.DRONE_R > c.h) continue;             // အပေါ်ကျော်နေ
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const minD = c.r + this.DRONE_R;
      if (d < minD) {
        const speed = v.length();
        if (speed > this.CRASH_SPEED) {
          physics.crashed = true;
          physics.disarm();
          return 'crash';
        }
        // slow bump — push out + kill inward velocity
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        p.x = c.x + nx * minD;
        p.z = c.z + nz * minD;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) { v.x -= vn * nx * 1.4; v.z -= vn * nz * 1.4; } // bounce
        return 'bump';
      }
    }
    return null;
  }
}
