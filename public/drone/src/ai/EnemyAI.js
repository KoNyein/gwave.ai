// ai/EnemyAI.js — enemy soldiers (behavior states + aim model) + wave manager + dog AI
// tasks 4.1, 4.2, 4.6 · Burmese callouts (4.8 hook)
import * as THREE from 'three';
import { Avatar } from '../avatar/Avatar.js';
import { Motions } from '../avatar/Motions.js';

const DIFF = {
  easy:   { reaction: 0.45, aimErr: 0.045, dmg: 8,  fireRate: 2.2 },
  normal: { reaction: 0.30, aimErr: 0.028, dmg: 11, fireRate: 3.0 },
  hard:   { reaction: 0.18, aimErr: 0.014, dmg: 15, fireRate: 4.0 },
};

export class EnemyAI {
  constructor(world, pos, collision, ctx, diff = 'normal') {
    this.world = world;
    this.ctx = ctx;                 // {player, audio, vo, tracer(a,b), collision}
    this.col = collision;
    this.d = DIFF[diff];
    this.avatar = new Avatar(world);
    this.avatar.root.position.copy(pos);
    // tint ရန်သူအနီ
    this.avatar.root.traverse(o => {
      if (o.material?.color && o.material.color.getHex() === 0x9aa7b8)
        o.material = o.material.clone(), o.material.color.setHex(0xb85a5a);
    });
    this.motions = new Motions(this.avatar);
    this.pos = this.avatar.root.position;
    this.hp = 100;
    this.alive = true;
    this.state = 'PATROL';          // PATROL | COMBAT | COVER | INVESTIGATE | DEAD
    this.yaw = Math.random() * Math.PI * 2;
    this.patrolTarget = null;
    this.seesPlayer = false;
    this.reactionT = 0;
    this.fireT = 0;
    this.peekT = 0;
    this.investigatePos = null;
    this.lastKnown = null;
    this.coverPoint = null;
    this.headY = 1.4; this.radius = 0.6;
    this.stateT = 0;
    // weapons target interface
    this.mesh = this.avatar.root;
    this.onHit = (dmg, point, head) => this.takeDamage(head ? dmg : dmg, null);
    this.getPos = () => this.pos;
  }

  takeDamage(dmg, fromPos) {
    if (!this.alive) return;
    this.hp -= dmg;
    if (this.state === 'PATROL') this._enter('INVESTIGATE',
      this.investigatePos = this.ctx.player.pos.clone());
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'DEAD';
      this.avatar.root.rotation.x = -Math.PI / 2 + 0.15;   // လဲကျ
      this.avatar.root.position.y = 0.15;
      this.ctx.vo?.('ရန်သူတစ်ယောက်ကျပြီ!', 'kill');
    }
  }

  _enter(state, arg) {
    this.state = state;
    this.stateT = 0;
    if (state === 'COMBAT') this.reactionT = this.d.reaction;
    if (state === 'COVER') this.coverPoint = arg;
    if (state === 'INVESTIGATE') this.investigatePos = arg;
  }

  _lineOfSight(target) {
    // 2D ray vs collision cylinders (tree/barrel/gate posts = blockers)
    const a = this.pos, b = target;
    for (const c of this.col.cylinders) {
      if (c.h < 1.4) continue;                     // ပုတဲ့ collider ကျော်မြင်ရ
      // point-line distance
      const abx = b.x - a.x, abz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((c.x - a.x) * abx + (c.z - a.z) * abz) /
        (abx * abx + abz * abz + 1e-6), 0, 1);
      const px = a.x + abx * t, pz = a.z + abz * t;
      if (Math.hypot(c.x - px, c.z - pz) < c.r + 0.1) return false;
    }
    return true;
  }

  _moveToward(target, speed, dt) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) return true;
    let dirX = dx / dist, dirZ = dz / dist;
    // obstacle steer: ရှေ့မှာ collider ရှိရင် ဘေးတိမ်း
    for (const c of this.col.cylinders) {
      const fx = this.pos.x + dirX * 1.6, fz = this.pos.z + dirZ * 1.6;
      const d2 = Math.hypot(c.x - fx, c.z - fz);
      if (d2 < c.r + 0.5) {
        const side = Math.sign((c.x - this.pos.x) * dirZ - (c.z - this.pos.z) * dirX) || 1;
        dirX += -dirZ * side * 0.9; dirZ += dirX * side * 0.9;
        const l = Math.hypot(dirX, dirZ); dirX /= l; dirZ /= l;
        break;
      }
    }
    this.pos.x += dirX * speed * dt;
    this.pos.z += dirZ * speed * dt;
    this.yaw = Math.atan2(dirX, dirZ);
    return false;
  }

  _fireAtPlayer(dt) {
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = 1 / this.d.fireRate + Math.random() * 0.15;
    const p = this.ctx.player;
    const from = this.pos.clone().setY(this.pos.y + 1.45);
    const to = p.pos.clone().setY(p.pos.y + (p.crouched ? 0.9 : 1.4));
    // aim error cone (distance scaled)
    const dist = from.distanceTo(to);
    const err = this.d.aimErr * dist;
    to.x += (Math.random() - 0.5) * err * 2;
    to.y += (Math.random() - 0.5) * err * 2;
    to.z += (Math.random() - 0.5) * err * 2;
    this.ctx.tracer(from, to);
    this.ctx.audio?.gunshot?.(200 + Math.random() * 40, 0.09);
    // hit? — miss offset < player radius
    const miss = to.distanceTo(p.pos.clone().setY(to.y));
    if (miss < 0.42) p.takeDamage(this.d.dmg, this.pos);
  }

  update(dt) {
    if (!this.alive) return;
    this.stateT += dt;
    const player = this.ctx.player;
    const distToPlayer = this.pos.distanceTo(player.pos);
    const los = distToPlayer < 55 && player.alive && this._lineOfSight(player.pos);
    this.seesPlayer = los;

    let moveSpeed = 0;
    switch (this.state) {
      case 'PATROL': {
        if (los) { this._enter('COMBAT'); this.ctx.vo?.('ရန်သူတွေ့တယ်! ပစ်!', 'enemy'); break; }
        if (!this.patrolTarget || this._moveToward(this.patrolTarget, 1.6, dt)) {
          const a = Math.random() * Math.PI * 2;
          this.patrolTarget = this.pos.clone()
            .add(new THREE.Vector3(Math.cos(a) * 12, 0, Math.sin(a) * 12));
          this.patrolTarget.x = THREE.MathUtils.clamp(this.patrolTarget.x, -80, 80);
          this.patrolTarget.z = THREE.MathUtils.clamp(this.patrolTarget.z, -80, 80);
        } else moveSpeed = 1.6;
        break;
      }
      case 'COMBAT': {
        if (!los) {
          this.lastKnown = player.pos.clone();
          if (this.stateT > 1.5) this._enter('INVESTIGATE', this.lastKnown);
          break;
        }
        this.yaw = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        this.reactionT -= dt;
        if (this.reactionT <= 0) this._fireAtPlayer(dt);
        // ရံဖန် cover ရှာ (နီးလွန်း / HP နည်း)
        if ((distToPlayer < 8 || this.hp < 40) && Math.random() < dt * 0.7) {
          const cover = this._findCover(player.pos);
          if (cover) { this._enter('COVER', cover); this.ctx.vo?.('ပုန်းလိုက်!', 'enemy'); }
        }
        break;
      }
      case 'COVER': {
        const arrived = this._moveToward(this.coverPoint, 4.2, dt);
        moveSpeed = arrived ? 0 : 4.2;
        if (arrived) {
          this.peekT += dt;
          if (this.peekT > 1.2) {           // peek-shoot cycle
            if (los) this._fireAtPlayer(dt);
            if (this.peekT > 2.0) this.peekT = 0;
          }
          if (this.stateT > 6) this._enter('COMBAT');
        }
        break;
      }
      case 'INVESTIGATE': {
        if (los) { this._enter('COMBAT'); break; }
        const arrived = this._moveToward(this.investigatePos, 3.2, dt);
        moveSpeed = arrived ? 0 : 3.2;
        if (arrived && this.stateT > 4) this._enter('PATROL');
        break;
      }
    }

    // animation sync
    this.avatar.root.rotation.y = this.yaw + Math.PI;
    this.motions.setAim(this.state === 'COMBAT' || (this.state === 'COVER' && this.peekT > 1.2) ? 1 : 0);
    this.motions.set(moveSpeed === 0 ? (this.state === 'COVER' ? 'CROUCH' : 'IDLE')
      : moveSpeed > 3 ? 'RUN' : 'WALK');
    this.motions.setLookTarget(this.seesPlayer ? player.pos.clone().setY(1.6) : null);
    this.motions.update(dt, moveSpeed);
  }

  _findCover(threat) {
    let best = null, bestScore = -1;
    for (const c of this.col.cylinders) {
      if (c.h < 1 || c.r < 0.4) continue;
      // threat ရဲ့ဆန့်ကျင်ဘက် behind cover
      const dx = c.x - threat.x, dz = c.z - threat.z;
      const d = Math.hypot(dx, dz);
      const px = c.x + dx / d * (c.r + 0.6), pz = c.z + dz / d * (c.r + 0.6);
      const distMe = Math.hypot(px - this.pos.x, pz - this.pos.z);
      if (distMe > 18) continue;
      const score = 10 - distMe + d * 0.1;
      if (score > bestScore) { bestScore = score; best = new THREE.Vector3(px, 0, pz); }
    }
    return best;
  }

  dispose() { this.world.remove(this.avatar.root); }
}

// ============================================================
export class DogAI {
  constructor(world, pos, ctx, traps) {
    this.world = world;
    this.ctx = ctx;
    this.traps = traps;
    this.pos = new THREE.Vector3().copy(pos);
    this.state = 'IDLE';            // IDLE | ALERT | CHASE | SNIFF | DEAD
    this.hp = 60;
    this.alive = true;
    this.barkT = 0;
    this.biteT = 0;
    this.stateT = 0;
    this.yaw = 0;
    this.headY = 0.6; this.radius = 0.5;
    this._build();
    this.mesh = this.group;
    this.onHit = (dmg) => this.takeDamage(dmg);
    this.getPos = () => this.pos;
    this.onBark = () => {};         // enemies alert hook
  }
  _build() {
    const g = this.group = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: 0x6b5233 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.75), fur);
    body.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.3), fur);
    head.position.set(0, 0.62, 0.45);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.14), fur);
    snout.position.set(0, 0.58, 0.63);
    this.legs = [];
    for (const [x, z] of [[-0.1, 0.28], [0.1, 0.28], [-0.1, -0.28], [0.1, -0.28]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.07), fur);
      l.position.set(x, 0.17, z);
      this.legs.push(l); g.add(l);
    }
    const tail = this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), fur);
    tail.position.set(0, 0.55, -0.5);
    g.add(body, head, snout, tail);
    g.traverse(o => { o.castShadow = true; });
    this.world.add(g);
  }

  takeDamage(dmg) {
    if (!this.alive) return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false; this.state = 'DEAD';
      this.group.rotation.z = Math.PI / 2;
      this.group.position.y = 0.1;
    } else this._enter('CHASE');
  }
  _enter(s) { this.state = s; this.stateT = 0; }

  update(dt) {
    if (!this.alive) return;
    this.stateT += dt;
    const p = this.ctx.player;
    const dist = this.pos.distanceTo(p.pos);
    // senses: hearing 40m (ပြေး/ပစ်ရင်), smell 25m, sight 30m
    const heard = dist < 40 && (p.moveSpeed > 5 || p.recentShot);
    const smelled = dist < 25;
    const seen = dist < 30;

    // mine sniff — mine 6m အတွင်းရှိရင် sniff+bark (owner team alert = player သတိပေး)
    const mine = this.traps?.activeMines?.().find(m =>
      Math.hypot(m.pos.x - this.pos.x, m.pos.z - this.pos.z) < 6);

    let speed = 0;
    switch (this.state) {
      case 'IDLE':
        if (mine) this._enter('SNIFF');
        else if (heard || smelled || seen) {
          this._enter('ALERT');
          this.ctx.vo?.('ခွေးက သတိထားမိသွားပြီ!', 'warn');
        }
        break;
      case 'SNIFF': {
        if (!mine) { this._enter('IDLE'); break; }
        speed = this._chase(new THREE.Vector3(mine.pos.x, 0, mine.pos.z), 1.5, dt, 1.2);
        this.barkT -= dt;
        if (this.barkT <= 0 && speed === 0) {
          this.barkT = 1.1;
          this.ctx.audio?.bark?.();
          this.ctx.vo?.('ခွေးက မိုင်းအနံ့ရနေတယ် — ဟောင်နေပြီ!', 'warn');
          this.onBark(this.pos);
        }
        break;
      }
      case 'ALERT': {
        this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        this.barkT -= dt;
        if (this.barkT <= 0) {
          this.barkT = 0.9;
          this.ctx.audio?.bark?.();
          this.onBark(p.pos);                       // ရန်သူတွေကို player position alert
        }
        if (this.stateT > 2.2 && seen) this._enter('CHASE');
        if (!heard && !smelled && !seen && this.stateT > 5) this._enter('IDLE');
        break;
      }
      case 'CHASE': {
        speed = this._chase(p.pos, 8.5, dt, 1.1);
        if (speed === 0) {                           // ကိုက်နိုင်အကွာ
          this.biteT -= dt;
          if (this.biteT <= 0) {
            this.biteT = 1.0;
            p.takeDamage(15, this.pos);
            p.stumble?.();
            this.ctx.audio?.bark?.(true);
          }
        }
        if (dist > 45) this._enter('IDLE');
        break;
      }
    }
    // motion: leg trot + tail wag
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const t = performance.now() * 0.001;
    if (speed > 0) this.legs.forEach((l, i) =>
      l.rotation.x = Math.sin(t * 14 + (i % 2) * Math.PI) * 0.7);
    else this.legs.forEach(l => l.rotation.x = 0);
    this.tail.rotation.y = Math.sin(t * (this.state === 'CHASE' ? 18 : 5)) * 0.5;
  }

  _chase(target, speed, dt, stopDist) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    this.yaw = Math.atan2(dx, dz);
    if (d < stopDist) return 0;
    this.pos.x += dx / d * speed * dt;
    this.pos.z += dz / d * speed * dt;
    return speed;
  }
  dispose() { this.world.remove(this.group); }
}

// ============================================================
export class WaveManager {
  constructor(world, collision, ctx, traps) {
    this.world = world;
    this.col = collision;
    this.ctx = ctx;
    this.traps = traps;
    this.enemies = [];
    this.dogs = [];
    this.wave = 0;
    this.state = 'IDLE';            // IDLE | ACTIVE | CLEARED
    this.spawnQueue = 0;
    this.spawnT = 0;
  }

  startWave() {
    this.wave++;
    this.state = 'ACTIVE';
    this.spawnQueue = 2 + this.wave;
    this.spawnT = 0;
    // wave 2+ မှာ ခွေးပါ
    if (this.wave >= 2 && this.dogs.filter(d => d.alive).length === 0) {
      const dog = new DogAI(this.world, this._spawnPos(), this.ctx, this.traps);
      dog.onBark = (pos) => this.enemies.forEach(e => {
        if (e.alive && e.state === 'PATROL') e._enter('INVESTIGATE', pos.clone());
      });
      this.dogs.push(dog);
      this.ctx.registerVictim(dog);
    }
    this.ctx.vo?.(`Wave ${this.wave} — ရန်သူတွေလာနေပြီ!`, 'wave');
  }

  _spawnPos() {
    const a = Math.random() * Math.PI * 2;
    const p = this.ctx.player.pos;
    return new THREE.Vector3(p.x + Math.cos(a) * 45, 0, p.z + Math.sin(a) * 45);
  }

  update(dt) {
    if (this.state !== 'ACTIVE') return;
    // staggered spawn
    if (this.spawnQueue > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 1.4;
        this.spawnQueue--;
        const diff = this.wave >= 4 ? 'hard' : this.wave >= 2 ? 'normal' : 'easy';
        const e = new EnemyAI(this.world, this._spawnPos(), this.col, this.ctx, diff);
        this.enemies.push(e);
        this.ctx.registerVictim(e);
      }
    }
    for (const e of this.enemies) e.update(dt);
    for (const d of this.dogs) d.update(dt);
    // cleared?
    if (this.spawnQueue === 0 && this.enemies.every(e => !e.alive)) {
      this.state = 'CLEARED';
      this.ctx.vo?.(`Wave ${this.wave} ရှင်းပြီး! [P] နဲ့ နောက် wave`, 'wave');
    }
  }
}
