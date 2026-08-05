// drone/DroneCombat.js — P6: kamikaze payload (6.1), scout marking (6.2), counters (6.3)
import * as THREE from 'three';

export class DroneCombat {
  constructor(world, explosion, audio, vo, collision) {
    this.world = world;
    this.ex = explosion;
    this.audio = audio;
    this.vo = vo;
    this.col = collision;

    // ---- payload (kamikaze) ----
    this.payload = {
      equipped: true,
      armed: false,
      ARM_DISTANCE: 30,        // deploy ကနေ 30m ကျော်မှ arm (safety)
      fuse: 'IMPACT',          // IMPACT | PROXIMITY | MANUAL
      radius: 6, damage: 220,
      traveled: 0,
      exploded: false,
    };
    this.deployPos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();

    // ---- drone survivability ----
    this.hp = 25;
    this.destroyed = false;
    this.rebuildT = 0;         // kamikaze/ပျက်ပြီးရင် 10s ပြန်ဆောက်

    // ---- video link ----
    this.signal = 1;           // 0..1
    this.linkLostT = 0;
    this.operatorPos = null;   // soldier pos ref (set from main)

    // ---- scout marking ----
    this.markTargets = [];     // enemies list ref
    this.markProgress = 0;
    this.markCandidate = null;
    this.markers = [];         // {mesh, target, life}

    // ---- jammer (counter) ----
    this.jammers = [];
    this._ray = new THREE.Vector3();
  }

  // ---------- lifecycle ----------
  onDeploy(dronePos, operatorPosRef) {
    this.deployPos.copy(dronePos);
    this.prevPos.copy(dronePos);
    this.operatorPos = operatorPosRef;
    this.payload.armed = false;
    this.payload.traveled = 0;
    this.payload.exploded = false;
    this.hp = 25;
    this.destroyed = false;
    this.signal = 1;
    this.linkLostT = 0;
  }

  addJammer(x, z, radius = 18) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x444a55 }));
    pole.position.y = 2.25;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x8a4444 }));
    dish.position.y = 4.4;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.15, radius, 40),
      new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    g.add(pole, dish, ring);
    g.position.set(x, 0, z);
    g.traverse(o => { o.castShadow = true; });
    this.world.add(g);
    const jam = { mesh: g, x, z, radius, alive: true,
      headY: 99, radius2: 0.8,
      onHit: (dmg) => {                        // ပစ်ဖျက်လို့ရ (counter-counter)
        jam.hp = (jam.hp ?? 40) - dmg;
        if (jam.hp <= 0 && jam.alive) {
          jam.alive = false;
          dish.material.color.setHex(0x222222);
          ring.visible = false;
          this.vo?.('Jammer ဖျက်ပြီး — airspace ပွင့်ပြီ!', 'wave');
        }
      } };
    this.jammers.push(jam);
    return jam;
  }

  takeDamage(dmg, physics) {
    if (this.destroyed) return;
    this.hp -= dmg;
    this.audio?.beep(500, 0.05, 0.3);
    if (this.hp <= 0) {
      this.destroyed = true;
      // ပစ်ချခံရ — payload ပေါက် (armed ရင်) မဟုတ်ရင် crash small
      if (this.payload.equipped && this.payload.armed && !this.payload.exploded) {
        this._detonate(physics);
      } else {
        physics.crashed = true;
        physics.disarm();
        this.ex.explode(physics.pos.clone(), { radius: 1.5, damage: 20 });
      }
      this.vo?.('Drone ပစ်ချခံရပြီ!', 'warn');
    }
  }

  _detonate(physics) {
    if (this.payload.exploded) return;
    this.payload.exploded = true;
    this.destroyed = true;
    this.rebuildT = 10;
    this.ex.explode(physics.pos.clone(), {
      radius: this.payload.radius, damage: this.payload.damage, fire: true });
    physics.crashed = true;
    physics.disarm();
  }

  manualDetonate(physics) {
    if (this.payload.equipped && this.payload.armed) this._detonate(physics);
    else this.vo?.('Payload မ arm ရသေး — 30m ကျော်ပျံပါ', 'warn');
  }

  // ---------- per-frame (FPV mode) ----------
  update(dt, physics, camera, enemies, destructibles, dog) {
    if (this.rebuildT > 0) this.rebuildT -= dt;
    if (this.destroyed) return;
    const pos = physics.pos;

    // ---- payload arming (travel distance) ----
    const pl = this.payload;
    if (pl.equipped && !pl.armed) {
      pl.traveled += pos.distanceTo(this.prevPos);
      if (pl.traveled >= pl.ARM_DISTANCE) {
        pl.armed = true;
        this.audio?.beep(1600, 0.08, 0.3);
        this.vo?.('⚠ PAYLOAD ARMED', 'warn');
      }
    }
    this.prevPos.copy(pos);

    // ---- fuses ----
    if (pl.equipped && pl.armed && physics.armed) {
      if (pl.fuse === 'IMPACT' && physics.crashed) this._detonate(physics);
      if (pl.fuse === 'PROXIMITY') {
        const near = [...enemies, ...(dog && dog.alive ? [dog] : [])]
          .some(e => e.alive && e.getPos().distanceTo(pos) < 1.6)
          || destructibles.items.some(d => d.alive && d.getPos().distanceTo(pos) < 2.2);
        if (near) this._detonate(physics);
      }
    }
    // impact fuse: crash ဖြစ်တာနဲ့ (fuse မရွေး armed ရင် ပေါက် — kamikaze core)
    if (pl.equipped && pl.armed && physics.crashed && !pl.exploded) this._detonate(physics);

    // ---- video link signal ----
    if (this.operatorPos) {
      const dist = pos.distanceTo(this.operatorPos);
      let sig = THREE.MathUtils.clamp(1 - dist / 320, 0, 1);
      // occlusion: operator→drone LoS ကြားက blockers
      let blocks = 0;
      for (const c of this.col.cylinders) {
        if (c.h < 2) continue;
        const ax = this.operatorPos.x, az = this.operatorPos.z;
        const bx = pos.x, bz = pos.z;
        const abx = bx - ax, abz = bz - az;
        const t = THREE.MathUtils.clamp(((c.x - ax) * abx + (c.z - az) * abz) /
          (abx * abx + abz * abz + 1e-6), 0, 1);
        if (Math.hypot(c.x - (ax + abx * t), c.z - (az + abz * t)) < c.r) blocks++;
        if (blocks >= 3) break;
      }
      sig *= Math.pow(0.75, blocks);
      // jammer zones
      for (const j of this.jammers) {
        if (j.alive && Math.hypot(pos.x - j.x, pos.z - j.z) < j.radius) sig *= 0.12;
      }
      this.signal += (sig - this.signal) * Math.min(1, dt * 6);
      // failsafe: link lost 2s → crash
      if (this.signal < 0.08) {
        this.linkLostT += dt;
        if (this.linkLostT > 2) {
          this.vo?.('Video link ပြတ် — drone failsafe!', 'warn');
          physics.crashed = true; physics.disarm();
          this.destroyed = true; this.rebuildT = 8;
        }
      } else this.linkLostT = 0;
    }

    // ---- scout marking: camera center 1s → mark 8s ----
    this._updateMarking(dt, physics, camera, enemies);
    this._updateMarkers(dt);
  }

  _updateMarking(dt, physics, camera, enemies) {
    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let candidate = null, bestAng = 0.05;             // ~2.8° cone
    for (const e of enemies) {
      if (!e.alive || this.markers.some(m => m.target === e)) continue;
      const to = e.getPos().clone().setY(e.getPos().y + 1.2).sub(physics.pos);
      const d = to.length();
      if (d > 120) continue;
      to.normalize();
      const ang = 1 - camDir.dot(to);
      if (ang < bestAng) { bestAng = ang; candidate = e; }
    }
    if (candidate && candidate === this.markCandidate) {
      this.markProgress += dt;
      if (this.markProgress >= 1) this._mark(candidate);
    } else {
      this.markCandidate = candidate;
      this.markProgress = 0;
    }
  }

  _mark(enemy) {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.4, 4),
      new THREE.MeshBasicMaterial({ color: 0xff3a3a, depthTest: false }));
    mesh.rotation.x = Math.PI;
    mesh.renderOrder = 999;
    this.world.add(mesh);
    this.markers.push({ mesh, target: enemy, life: 8 });
    this.markProgress = 0;
    this.markCandidate = null;
    this.audio?.beep(2000, 0.1, 0.3);
    this.vo?.('ရန်သူ mark လုပ်ပြီး — team မြင်ရပြီ (8s)', 'wave');
  }

  _updateMarkers(dt) {
    const t = performance.now() * 0.003;
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.life -= dt;
      if (m.life <= 0 || !m.target.alive) {
        this.world.remove(m.mesh);
        m.mesh.geometry.dispose(); m.mesh.material.dispose();
        this.markers.splice(i, 1);
        continue;
      }
      const p = m.target.getPos();
      m.mesh.position.set(p.x, p.y + 2.2 + Math.sin(t) * 0.1, p.z);
      m.mesh.rotation.y += dt * 2;
    }
  }
}
