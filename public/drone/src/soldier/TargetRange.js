// soldier/TargetRange.js — task 3.5: target boards, hit feedback, damage numbers
import * as THREE from 'three';

export class TargetRange {
  constructor(world, weaponSystem, camera) {
    this.world = world;
    this.ws = weaponSystem;
    this.camera = camera;
    this.targets = [];
    this.dmgNumbers = [];        // {el, worldPos, life}
    this.host = document.getElementById('dmg-layer');
    this._build();
  }

  _build() {
    // range area: soldier spawn ရှေ့ z=-15..-45 target 6 ခု
    const positions = [
      [-6, -18], [0, -22], [6, -18],
      [-8, -34], [0, -38], [8, -34],
    ];
    positions.forEach(([x, z], i) => this._spawnTarget(x, z, i >= 3));
  }

  _spawnTarget(x, z, far) {
    const g = new THREE.Group();
    // board: body + head (human silhouette style)
    const mat = new THREE.MeshLambertMaterial({ color: far ? 0xc9803a : 0xd9534f });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 0.06), mat);
    body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10), mat);
    head.position.y = 1.55;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x555 }));
    stand.position.y = 0.1;
    g.add(body, head, stand);
    g.position.set(x, 0, z);
    g.traverse(o => { o.castShadow = true; });
    this.world.add(g);

    const target = {
      mesh: g, hp: 100, maxHp: 100, headY: 1.4, radius: 0.7,
      downT: 0,
      onHit: (dmg, point, isHead) => this._hit(target, dmg, point, isHead),
    };
    this.targets.push(target);
    this.ws.targets.push(target);
  }

  _hit(t, dmg, point, isHead) {
    if (t.downT > 0) return;
    t.hp -= dmg;
    this._dmgNumber(dmg, point, isHead);
    // flash white
    t.mesh.traverse(o => {
      if (o.material?.emissive) {
        o.material.emissive.setHex(0xffffff);
        setTimeout(() => o.material.emissive.setHex(0x000000), 60);
      }
    });
    if (t.hp <= 0) {
      t.downT = 3;                            // 3s respawn
      t.mesh.rotation.x = -Math.PI / 2 + 0.1; // လဲကျ
    }
  }

  _dmgNumber(dmg, worldPos, isHead) {
    if (!this.host) return;
    const el = document.createElement('div');
    el.className = 'dmg' + (isHead ? ' head' : '');
    el.textContent = (isHead ? '★' : '') + dmg;
    this.host.appendChild(el);
    this.dmgNumbers.push({ el, pos: worldPos.clone(), life: 0.9, rise: 0 });
  }

  update(dt) {
    // respawn
    for (const t of this.targets) {
      if (t.downT > 0) {
        t.downT -= dt;
        if (t.downT <= 0) {
          t.hp = t.maxHp;
          t.mesh.rotation.x = 0;
        }
      }
    }
    // damage numbers — project to screen
    const v = new THREE.Vector3();
    for (let i = this.dmgNumbers.length - 1; i >= 0; i--) {
      const d = this.dmgNumbers[i];
      d.life -= dt; d.rise += dt * 55;
      if (d.life <= 0) { d.el.remove(); this.dmgNumbers.splice(i, 1); continue; }
      v.copy(d.pos).project(this.camera);
      if (v.z > 1) { d.el.style.display = 'none'; continue; }
      d.el.style.display = 'block';
      d.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
      d.el.style.top = ((1 - (v.y + 1) / 2) * innerHeight - d.rise) + 'px';
      d.el.style.opacity = Math.min(1, d.life * 2);
    }
  }
}
