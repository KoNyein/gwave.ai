import * as THREE from 'three';

/**
 * Phase 2 — racing systems (PHASES.md 2.1/2.2/2.5/2.6):
 *  - gate crossing (segment vs gate plane, inside the 6×5m frame) + strict
 *    checkpoint order → lap / best-lap timing
 *  - simple obstacle colliders (spheres/cylinders/boxes) → crash
 *  - ghost replay: best lap recorded at 20Hz, replayed as a translucent drone
 *  - track format: plain JSON (gates/props) — /drone/tracks/*.json
 */
export class Race {
  constructor(world, droneMeshFactory) {
    this.world = world;
    this.gates = [];        // {pos, normal, halfW, halfH, mesh}
    this.colliders = [];    // {type:'sphere'|'cylinder', pos, r, h?}
    this.next = 0;
    this.lapStart = 0;
    this.running = false;
    this.lapTime = 0;
    this.bestTime = Number(localStorage.getItem('gwdrone:best') || 0) || null;
    this.lastPos = new THREE.Vector3();
    // ghost
    this.rec = [];
    this.best = JSON.parse(localStorage.getItem('gwdrone:ghost') || 'null');
    this.ghostMesh = droneMeshFactory();
    this.ghostMesh.traverse((o) => {
      if (o.material) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.35;
      }
    });
    this.ghostMesh.visible = false;
    world.add(this.ghostMesh);
    this.recAcc = 0;
  }

  registerGate(mesh, halfW = 3, halfH = 2.5) {
    const pos = new THREE.Vector3();
    mesh.getWorldPosition(pos);
    pos.y += halfH; // frame center height
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
    this.gates.push({ pos, normal, halfW, halfH, mesh });
  }

  registerCollider(c) {
    this.colliders.push(c);
  }

  /** Segment lastPos→pos crosses the next gate's plane inside the frame? */
  _crossed(gate, from, to) {
    const d0 = gate.normal.dot(new THREE.Vector3().subVectors(from, gate.pos));
    const d1 = gate.normal.dot(new THREE.Vector3().subVectors(to, gate.pos));
    if (d0 * d1 > 0) return false; // same side — no crossing
    const t = d0 / (d0 - d1 || 1e-9);
    const hit = new THREE.Vector3().lerpVectors(from, to, t).sub(gate.pos);
    // project into the gate's local frame
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(gate.mesh.quaternion);
    return (
      Math.abs(hit.dot(right)) < gate.halfW &&
      Math.abs(hit.y) < gate.halfH
    );
  }

  /** Sphere (drone, r≈0.18) vs obstacle colliders → true = crash */
  hitsObstacle(pos) {
    const r = 0.18;
    for (const c of this.colliders) {
      if (c.type === 'sphere') {
        if (pos.distanceTo(c.pos) < c.r + r) return true;
      } else {
        // vertical cylinder (barrels, trunks, gate posts)
        const dx = pos.x - c.pos.x;
        const dz = pos.z - c.pos.z;
        if (
          dx * dx + dz * dz < (c.r + r) * (c.r + r) &&
          pos.y > c.pos.y - 0.1 &&
          pos.y < c.pos.y + c.h
        ) {
          return true;
        }
      }
    }
    return false;
  }

  update(pos, quat, now, armed) {
    if (!armed) {
      this.lastPos.copy(pos);
      this._ghostStep(now);
      return;
    }
    const gate = this.gates[this.next];
    if (gate && this._crossed(gate, this.lastPos, pos)) {
      gate.mesh.traverse((o) => {
        if (o.material) o.material.emissive?.setHex(0x2bff66);
      });
      setTimeout(() => gate.mesh.traverse((o) => {
        if (o.material) o.material.emissive?.setHex(0x000000);
      }), 350);
      if (this.next === 0) {
        // start/finish line
        if (this.running) {
          this.lapTime = (now - this.lapStart) / 1000;
          if (!this.bestTime || this.lapTime < this.bestTime) {
            this.bestTime = this.lapTime;
            localStorage.setItem('gwdrone:best', String(this.bestTime));
            this.best = this.rec;
            try {
              localStorage.setItem('gwdrone:ghost', JSON.stringify(this.rec));
            } catch { /* ghost too big for storage — keep in memory */ }
          }
        }
        this.lapStart = now;
        this.running = true;
        this.rec = [];
      }
      this.next = (this.next + 1) % this.gates.length;
    }
    // ghost recording at 20Hz
    if (this.running) {
      this.recAcc = (this.recAcc || 0) + 1;
      if (this.recAcc % 3 === 0) {
        this.rec.push([
          now - this.lapStart,
          pos.x, pos.y, pos.z,
          quat.x, quat.y, quat.z, quat.w,
        ]);
        if (this.rec.length > 20 * 180) this.rec.length = 0; // 3min cap
      }
    }
    this.lastPos.copy(pos);
    this._ghostStep(now);
  }

  _ghostStep(now) {
    const g = this.best;
    if (!g || g.length < 2 || !this.running) {
      this.ghostMesh.visible = false;
      return;
    }
    const t = now - this.lapStart;
    let i = 0;
    while (i < g.length - 1 && g[i + 1][0] < t) i++;
    if (i >= g.length - 1) {
      this.ghostMesh.visible = false;
      return;
    }
    const a = g[i];
    const b = g[i + 1];
    const k = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
    this.ghostMesh.visible = true;
    this.ghostMesh.position.set(
      a[1] + (b[1] - a[1]) * k,
      a[2] + (b[2] - a[2]) * k,
      a[3] + (b[3] - a[3]) * k,
    );
    this.ghostMesh.quaternion.set(a[4], a[5], a[6], a[7]).normalize();
  }

  osdText(now) {
    const cur = this.running ? (now - this.lapStart) / 1000 : 0;
    const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
    return (
      `⏱${fmt(cur)}  GATE:${this.next}/${this.gates.length}` +
      (this.lapTime ? `  LAP:${fmt(this.lapTime)}` : '') +
      (this.bestTime ? `  BEST:${fmt(this.bestTime)}` : '')
    );
  }
}
