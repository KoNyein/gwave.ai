// combat/Explosion.js — explosion VFX kit + AoE damage (task 4.7)
// particles + shockwave ring + debris + camera shake + fire spawn hook
import * as THREE from 'three';

export class ExplosionSystem {
  constructor(world, audio) {
    this.world = world;
    this.audio = audio;
    this.active = [];
    this.shake = 0;                     // camera shake amount (main loop ကဖတ်)
    this.damageables = [];              // {getPos():V3, takeDamage(dmg, fromPos), alive}
    this.onExplode = () => {};          // fire grid hook (pos, radius)
  }

  register(d) { this.damageables.push(d); }

  explode(pos, { radius = 6, damage = 180, fire = false } = {}) {
    // ---- AoE damage (falloff) ----
    for (const d of this.damageables) {
      if (d.alive === false) continue;
      const dist = d.getPos().distanceTo(pos);
      if (dist < radius) {
        const dmg = Math.round(damage * (1 - dist / radius) ** 1.2);
        if (dmg > 0) d.takeDamage(dmg, pos);
      }
    }
    // ---- VFX ----
    const group = new THREE.Group();
    group.position.copy(pos);
    // fireball sprite (billboard planes ×3)
    const fbMat = new THREE.MeshBasicMaterial({
      color: 0xff8a2a, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const fireball = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.28, 10, 8), fbMat);
    // shockwave ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe0b0, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    // smoke sphere
    const smokeMat = new THREE.MeshLambertMaterial({
      color: 0x3a3a3a, transparent: true, opacity: 0.55, depthWrite: false });
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.22, 8, 6), smokeMat);
    // spark particles
    const N = 60;
    const pgeo = new THREE.BufferGeometry();
    const parr = new Float32Array(N * 3);
    const pvel = [];
    for (let i = 0; i < N; i++) {
      parr[i * 3] = 0; parr[i * 3 + 1] = 0.3; parr[i * 3 + 2] = 0;
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.5;
      const sp = 4 + Math.random() * radius * 1.6;
      pvel.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * sp,
        Math.sin(e) * sp, Math.sin(a) * Math.cos(e) * sp));
    }
    pgeo.setAttribute('position', new THREE.BufferAttribute(parr, 3));
    const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({
      color: 0xffb050, size: 0.18, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    // debris chunks ×6 (rigid-ish)
    const debris = [];
    for (let i = 0; i < 6; i++) {
      const dmesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14),
        new THREE.MeshLambertMaterial({ color: 0x2c2c2c }));
      dmesh.position.y = 0.4;
      const a = Math.random() * Math.PI * 2;
      debris.push({ mesh: dmesh,
        vel: new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 4),
          4 + Math.random() * 4, Math.sin(a) * (2 + Math.random() * 4)),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0) });
      group.add(dmesh);
    }
    group.add(fireball, ring, smoke, pts);
    this.world.add(group);
    this.active.push({ group, fireball, ring, smoke, pts, pvel, debris, t: 0, radius });

    // shake (distance ကို main loop က camera နဲ့တွက်မယ့်အစား global peak)
    this.shake = Math.max(this.shake, Math.min(1, radius / 6));
    this.audio?.explosion?.(radius);
    if (fire) this.onExplode(pos, radius * 0.55);
  }

  update(dt) {
    this.shake *= Math.max(0, 1 - dt * 3.2);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.t += dt;
      const T = 1.1, k = e.t / T;
      // fireball: ချဲ့ + မှိန်
      e.fireball.scale.setScalar(1 + k * 2.4);
      e.fireball.material.opacity = Math.max(0, 0.95 - k * 2.2);
      // ring: အပြင်ပြေး
      e.ring.scale.setScalar(1 + k * e.radius * 2.2);
      e.ring.material.opacity = Math.max(0, 0.7 - k * 1.4);
      // smoke: တက် + ကြီး
      e.smoke.position.y += dt * 2.2;
      e.smoke.scale.setScalar(1 + k * 3.5);
      e.smoke.material.opacity = Math.max(0, 0.55 - k * 0.55);
      // particles
      const pos = e.pts.geometry.attributes.position;
      for (let j = 0; j < e.pvel.length; j++) {
        e.pvel[j].y -= 9.8 * dt;
        pos.array[j * 3] += e.pvel[j].x * dt;
        pos.array[j * 3 + 1] += e.pvel[j].y * dt;
        pos.array[j * 3 + 2] += e.pvel[j].z * dt;
      }
      pos.needsUpdate = true;
      e.pts.material.opacity = Math.max(0, 1 - k * 1.2);
      // debris
      for (const d of e.debris) {
        d.vel.y -= 9.8 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.mesh.position.y < 0.05) { d.mesh.position.y = 0.05; d.vel.set(0, 0, 0); }
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.y += d.spin.y * dt;
      }
      if (e.t > T + 1.5) {
        this.world.remove(e.group);
        e.group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
        this.active.splice(i, 1);
      }
    }
  }
}
