// net/NetClient.js — P5 client: state sync + 100ms interpolation + remote players
import * as THREE from 'three';
import { Avatar } from '../avatar/Avatar.js';
import { Motions } from '../avatar/Motions.js';

const SEND_HZ = 20;
const INTERP_MS = 100;

export class NetClient {
  constructor(world, vo, buildDroneMesh) {
    this.world = world;
    this.vo = vo;
    this.buildDroneMesh = buildDroneMesh;
    this.ws = null;
    this.id = 0;
    this.connected = false;
    this.remotes = new Map();       // id → RemotePlayer
    this.sendT = 0;
    this.pingMs = 0;
    this.onRemoteShot = () => {};   // (from, to)
    this.onRemoteBoom = () => {};
    this.onLocalHit = () => {};     // (dmg, hp)
    this.board = [];
  }

  connect(url, name, room = 'valley', token = null) {
    this.token = token ?? (() => { try { return localStorage.getItem('gwave_token'); } catch { return null; } })();
    try { this.ws = new WebSocket(url); } catch (e) {
      this.vo?.('Server ချိတ်မရ — URL စစ်ပါ', 'warn'); return;
    }
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ t: 'join', name, room, token: this.token }));
    };
    this.ws.onclose = () => {
      this.connected = false;
      for (const r of this.remotes.values()) r.dispose(this.world);
      this.remotes.clear();
      this.vo?.('Server အဆက်ပြတ်', 'warn');
    };
    this.ws.onmessage = e => this._onMsg(JSON.parse(e.data));
  }
  disconnect() { this.ws?.close(); }

  _onMsg(m) {
    switch (m.t) {
      case 'authfail':
        this.vo?.(`Login လိုသည် (auth: ${m.authMode}) — gwave.cc ကနေဝင်ပါ`, 'warn');
        break;
      case 'welcome':
        this.id = m.id; this.connected = true;
        this.vo?.(`Online ဝင်ပြီး — Room: ${m.room}`, 'wave');
        for (const p of m.players) if (p.id !== this.id) this._addRemote(p);
        break;
      case 'join':
        this._addRemote(m.p);
        this.vo?.(`${m.p.name} ဝင်လာပြီ`, 'info');
        break;
      case 'leave': {
        const r = this.remotes.get(m.id);
        if (r) { this.vo?.(`${r.name} ထွက်သွားပြီ`, 'info'); r.dispose(this.world); this.remotes.delete(m.id); }
        break;
      }
      case 's': {
        const now = performance.now();
        for (const ps of m.p) {
          if (ps.id === this.id) continue;
          const r = this.remotes.get(ps.id) ?? this._addRemote({ id: ps.id, name: '?' });
          r.push(now, ps);
        }
        break;
      }
      case 'shot':
        if (m.from && m.to) this.onRemoteShot(
          new THREE.Vector3(...m.from), new THREE.Vector3(...m.to));
        break;
      case 'hit':
        if (m.id === this.id) this.onLocalHit(m.dmg, m.hp);
        break;
      case 'kill': {
        const by = m.by === this.id ? 'မင်း' : (this.remotes.get(m.by)?.name ?? '?');
        const v = m.victim === this.id ? 'မင်း' : (this.remotes.get(m.victim)?.name ?? '?');
        this.board = m.board;
        this.vo?.(`💀 ${by} က ${v} ကို ချလိုက်ပြီ`, m.by === this.id ? 'wave' : 'warn');
        break;
      }
      case 'respawn':
        if (m.id === this.id) this.onRespawn?.(m.pos);
        break;
      case 'correct':
        this.onCorrect?.(m.pos);          // server rejection → snap back
        break;
      case 'boom':
        if (m.pos) this.onRemoteBoom(new THREE.Vector3(...m.pos), m.radius);
        break;
      case 'chat':
        this.vo?.(`${m.name}: ${m.msg}`, 'info');
        break;
    }
  }

  _addRemote(p) {
    const r = new RemotePlayer(this.world, p, this.buildDroneMesh);
    this.remotes.set(p.id, r);
    return r;
  }

  // local state → server (20Hz)
  sendState(dt, state) {
    if (!this.connected) return;
    this.sendT += dt;
    if (this.sendT < 1 / SEND_HZ) return;
    this.sendT = 0;
    this.ws.send(JSON.stringify({ t: 'u', ...state }));
  }

  sendShoot(from, to, hitId, dmg) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ t: 'shoot',
      from: [from.x, from.y, from.z], to: [to.x, to.y, to.z],
      hit: hitId ?? 0, dmg, lagMs: this.pingMs }));
  }
  sendBoom(pos, radius) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ t: 'boom', pos: [pos.x, pos.y, pos.z], radius }));
  }

  update(dt) {
    const renderT = performance.now() - INTERP_MS;
    for (const r of this.remotes.values()) r.update(dt, renderT);
  }
}

// ---------- remote player: avatar + drone + interpolation buffer ----------
class RemotePlayer {
  constructor(world, p, buildDroneMesh) {
    this.id = p.id;
    this.name = p.name ?? '?';
    this.avatar = new Avatar(world);
    // remote အပြာရောင် tint
    this.avatar.root.traverse(o => {
      if (o.material?.color && o.material.color.getHex() === 0x9aa7b8)
        o.material = o.material.clone(), o.material.color.setHex(0x5a7ab8);
    });
    this.motions = new Motions(this.avatar);
    this.drone = buildDroneMesh();
    this.drone.visible = false;
    world.add(this.drone);
    if (p.pos) this.avatar.root.position.set(...p.pos);
    this.buf = [];                   // [{t, ps}]
    this.mode = 0;
    this.hitboxY = 1.4;
    // weapons target interface (PvP — local player ပစ်လို့ရ)
    this.mesh = this.avatar.root;
    this.alive = true;
    this.getPos = () => this.avatar.root.position;
  }

  push(t, ps) {
    this.buf.push({ t, ps });
    if (this.buf.length > 30) this.buf.shift();
    if (ps.a) this.anim = ps.a;
    this.mode = ps.m;
    this.alive = ps.hp > 0;
  }

  update(dt, renderT) {
    // interpolate between two snapshots around renderT
    const b = this.buf;
    if (b.length < 2) { this.motions.update(dt, 0); return; }
    let i = b.length - 2;
    while (i > 0 && b[i].t > renderT) i--;
    const A = b[i], B = b[i + 1];
    const span = Math.max(1, B.t - A.t);
    const k = THREE.MathUtils.clamp((renderT - A.t) / span, 0, 1);
    const lerp3 = (a, c) => [
      a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k];
    const pos = lerp3(A.ps.pos, B.ps.pos);
    this.avatar.root.position.set(...pos);
    const yaw = A.ps.yaw + (B.ps.yaw - A.ps.yaw) * k;
    this.avatar.root.rotation.y = yaw + Math.PI;
    // movement speed from snapshots → anim
    const spd = Math.hypot(B.ps.pos[0] - A.ps.pos[0], B.ps.pos[2] - A.ps.pos[2]) / (span / 1000);
    this.motions.set(this.mode === 1 ? 'PILOT_SIT'
      : spd < 0.3 ? 'IDLE' : spd > 4.5 ? 'RUN' : 'WALK');
    this.motions.update(dt, spd);
    // drone
    const showDrone = this.mode === 1 && A.ps.dp && B.ps.dp;
    this.drone.visible = showDrone;
    if (showDrone) {
      this.drone.position.set(...lerp3(A.ps.dp, B.ps.dp));
      if (B.ps.dq) this.drone.quaternion.set(...B.ps.dq);
      this.drone.props?.forEach(p => p.rotation.z += dt * 40);
    }
    this.avatar.root.visible = this.alive;
  }

  dispose(world) {
    world.remove(this.avatar.root);
    world.remove(this.drone);
  }
}
