// combat/FireGrid.js — မီးကူးစက်မှု grid (task 4.5)
import * as THREE from 'three';

const CELL = 2;
export class FireGrid {
  constructor(world, explosion) {
    this.world = world;
    this.ex = explosion;
    this.cells = new Map();          // "x,z" → {mesh, life, spreadT}
    this.tick = 0;
  }
  _key(x, z) { return (Math.round(x / CELL) * CELL) + ',' + (Math.round(z / CELL) * CELL); }

  ignite(x, z, life = 9) {
    const key = this._key(x, z);
    if (this.cells.has(key)) return;
    const [cx, cz] = key.split(',').map(Number);
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.4, 6),
      new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.position.set(cx, 0.7, cz);
    this.world.add(mesh);
    this.cells.set(key, { mesh, life, spreadT: 1.6 + Math.random(), cx, cz });
  }

  igniteArea(pos, radius) {
    for (let dx = -radius; dx <= radius; dx += CELL)
      for (let dz = -radius; dz <= radius; dz += CELL)
        if (Math.hypot(dx, dz) <= radius && Math.random() < 0.7)
          this.ignite(pos.x + dx, pos.z + dz);
  }

  update(dt) {
    this.tick += dt;
    for (const [key, c] of this.cells) {
      c.life -= dt;
      c.spreadT -= dt;
      // flicker
      c.mesh.scale.y = 0.8 + Math.sin(this.tick * 11 + c.cx) * 0.25;
      c.mesh.material.opacity = Math.min(0.85, c.life * 0.4);
      // spread (40% chance per interval, life ကျန်များမှ)
      if (c.spreadT <= 0 && c.life > 3) {
        c.spreadT = 2 + Math.random() * 2;
        if (Math.random() < 0.4) {
          const dirs = [[CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL]];
          const [dx, dz] = dirs[(Math.random() * 4) | 0];
          if (this.cells.size < 60) this.ignite(c.cx + dx, c.cz + dz, 6);
        }
      }
      if (c.life <= 0) {
        this.world.remove(c.mesh);
        c.mesh.geometry.dispose(); c.mesh.material.dispose();
        this.cells.delete(key);
      }
    }
  }

  // pos မှာ မီးလောင်နေလား (burn damage query)
  burning(pos) { return this.cells.has(this._key(pos.x, pos.z)); }
}

// ============================================================
// combat/Destructibles — ကားများ + red barrels: HP→မီးခိုး→မီး→countdown→ပေါက်ကွဲ chain (task 4.4)
export class Destructibles {
  constructor(world, explosion, fire, weapons) {
    this.world = world;
    this.ex = explosion;
    this.fire = fire;
    this.items = [];
    this.weapons = weapons;
  }

  addCar(x, z, yaw = 0) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.2),
      new THREE.MeshLambertMaterial({ color: 0x4a6b4a }));
    body.position.y = 0.75;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x3a5a3a }));
    cab.position.set(0, 1.35, -0.3);
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 10),
        new THREE.MeshLambertMaterial({ color: 0x161616 }));
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.4, wz);
      g.add(w);
    }
    g.add(body, cab);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    g.traverse(o => { o.castShadow = true; });
    this.world.add(g);
    this._register(g, 'CAR', 120, 5.5, 220);
  }

  addBarrel(x, z) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.05, 12),
      new THREE.MeshLambertMaterial({ color: 0xb03030 }));
    b.position.set(x, 0.52, z);
    b.castShadow = true;
    this.world.add(b);
    this._register(b, 'BARREL', 30, 4.5, 150);
  }

  _register(mesh, type, hp, radius, damage) {
    const item = {
      mesh, type, hp, maxHp: hp, radius, damage,
      state: 'OK',            // OK | SMOKE | FIRE | DEAD
      countdown: 0,
      headY: 99, radius2: 2.4, alive: true,
      getPos: () => mesh.position,
      // weapon hits
      onHit: (dmg) => this._damage(item, dmg),
      // explosion AoE hits (chain!)
      takeDamage: (dmg) => this._damage(item, dmg),
    };
    this.items.push(item);
    this.weapons.targets.push({ mesh, headY: 99, radius: 2.4,
      onHit: (d, p) => item.onHit(d) });
    this.ex.register(item);
  }

  _damage(item, dmg) {
    if (item.state === 'DEAD') return;
    item.hp -= dmg;
    if (item.hp <= item.maxHp * 0.4 && item.state === 'OK') item.state = 'SMOKE';
    if (item.hp <= item.maxHp * 0.15 && item.state === 'SMOKE') {
      item.state = 'FIRE';
      item.countdown = item.type === 'CAR' ? 3 : 0.6;   // ကား 3s, barrel ချက်ချင်းနီးပါး
      this.fire.ignite(item.mesh.position.x, item.mesh.position.z, 4);
    }
    if (item.hp <= 0 && item.state !== 'FIRE' && item.state !== 'DEAD') {
      item.state = 'FIRE'; item.countdown = 0.25;
    }
  }

  update(dt) {
    for (const item of this.items) {
      if (item.state === 'FIRE') {
        item.countdown -= dt;
        // မီးတောက် flicker tint
        item.mesh.traverse(o => o.material?.color?.offsetHSL?.(0, 0, Math.sin(performance.now() * 0.02) * 0.002));
        if (item.countdown <= 0) {
          item.state = 'DEAD';
          item.alive = false;
          this.ex.explode(item.mesh.position.clone().setY(0.6),
            { radius: item.radius, damage: item.damage, fire: item.type === 'CAR' });
          // wreck: မဲ + နိမ့်
          item.mesh.traverse(o => o.material?.color?.setHex(0x191919));
          item.mesh.scale.y = 0.55;
          if (item.type === 'BARREL') item.mesh.visible = false;
        }
      }
    }
  }
}

// ============================================================
// combat/Traps — ဗုံးထောင်စနစ် (task 4.3): LANDMINE / TRIPWIRE / C4 remote
export class TrapSystem {
  constructor(world, explosion, audio) {
    this.world = world;
    this.ex = explosion;
    this.audio = audio;
    this.traps = [];
    this.tripwirePending = null;      // first stake pos
    this.victims = [];                // {getPos, alive} — player/enemies/dog
    this.onMessage = () => {};
  }

  placeMine(pos) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.07, 10),
      new THREE.MeshLambertMaterial({ color: 0x2a3a2a }));
    mesh.position.copy(pos).setY(0.04);
    this.world.add(mesh);
    this.traps.push({ type: 'MINE', mesh, pos: mesh.position, armT: 3,
      radius: 1.3, dmg: 150, exRadius: 4, alive: true });
    this.audio?.beep(900, 0.05, 0.2);
    this.onMessage('မိုင်းထောင်နေသည်… ၃ စက္ကန့်');
  }

  placeTripwireStake(pos) {
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a4a2a }));
    stake.position.copy(pos).setY(0.25);
    this.world.add(stake);
    if (!this.tripwirePending) {
      this.tripwirePending = pos.clone();
      this.onMessage('ကြိုးစ ၁ စိုက်ပြီး — ဒုတိယနေရာရွေးပါ');
    } else {
      const a = this.tripwirePending, b = pos.clone();
      if (a.distanceTo(b) > 12) { this.onMessage('ကြိုးရှည်လွန်း (12m max)'); this.tripwirePending = null; return; }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a.clone().setY(0.35), b.clone().setY(0.35)]),
        new THREE.LineBasicMaterial({ color: 0x883333, transparent: true, opacity: 0.5 }));
      this.world.add(line);
      this.traps.push({ type: 'TRIPWIRE', a, b, mesh: line, armT: 2,
        dmg: 130, exRadius: 4, alive: true, prev: new Map() });
      this.tripwirePending = null;
      this.onMessage('Tripwire ထောင်ပြီးပြီ');
    }
  }

  placeC4(pos) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.15),
      new THREE.MeshLambertMaterial({ color: 0x8a7a3a }));
    mesh.position.copy(pos).setY(0.05);
    this.world.add(mesh);
    this.traps.push({ type: 'C4', mesh, pos: mesh.position, armT: 1,
      dmg: 200, exRadius: 7, alive: true });
    this.onMessage('C4 တပ်ပြီး — [G] နဲ့ဖောက်ပါ');
  }

  detonateC4() {
    let n = 0;
    for (const t of this.traps) {
      if (t.type === 'C4' && t.alive && t.armT <= 0) { this._boom(t); n++; }
    }
    if (n) this.onMessage('C4 ဖောက်ပြီး!');
  }

  _boom(t) {
    t.alive = false;
    this.world.remove(t.mesh);
    const p = (t.pos ?? t.a.clone().lerp(t.b, 0.5)).clone().setY(0.3);
    this.ex.explode(p, { radius: t.exRadius, damage: t.dmg, fire: false });
  }

  update(dt) {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      if (!t.alive) { this.traps.splice(i, 1); continue; }
      if (t.armT > 0) { t.armT -= dt; if (t.armT <= 0) this.audio?.beep(1400, 0.06, 0.2); continue; }
      if (t.type === 'MINE') {
        for (const v of this.victims) {
          if (v.alive === false) continue;
          const p = v.getPos();
          if (Math.hypot(p.x - t.pos.x, p.z - t.pos.z) < t.radius && p.y < 1.6) {
            this._boom(t); break;
          }
        }
      } else if (t.type === 'TRIPWIRE') {
        for (const v of this.victims) {
          if (v.alive === false) continue;
          const p = v.getPos();
          const prev = t.prev.get(v) ?? p.clone();
          // segment(prev→p) vs segment(a→b) 2D crossing
          if (p.y < 1.2 && segsCross(prev, p, t.a, t.b)) { this._boom(t); break; }
          t.prev.set(v, p.clone());
        }
      }
    }
  }

  // ခွေးအနံ့ခံရန် — mine positions expose
  activeMines() { return this.traps.filter(t => t.type === 'MINE' && t.alive && t.armT <= 0); }
}

function segsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
