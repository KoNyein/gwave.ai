// ============================================================
// NetClient.js — Multiplayer Client v2 (PvP + Server-Authoritative)
// Server မရှိလျှင်လည်း ဂိမ်း ပုံမှန်ဆက်ကစားနိုင် (offline-safe)
// ✔ Remote players interpolation ✔ snap-back ✔ PvP shoot claims
// ✔ Hit/Kill/Respawn events (server ကသာ ဆုံးဖြတ်) ✔ Cognito token ပို့
// ============================================================
import * as THREE from 'three';
import { makeNameLabel } from '../ui/label.js';

const SEND_HZ = 15;

// ---- Remote ကစားသမား ----
class RemotePlayer {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.group = new THREE.Group();

    const hue = (id * 47) % 360;
    const color = new THREE.Color(`hsl(${hue}, 70%, 55%)`);
    this.bodyMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 6, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
    );
    this.bodyMesh.position.y = 0.95; this.bodyMesh.castShadow = true;
    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0 })
    );
    this.headMesh.position.y = 1.75;
    // PvP raycast အတွက် — Weapon က ဒီ userData ကိုကြည့်သည်
    this.bodyMesh.userData.netId = id;
    this.headMesh.userData.netId = id;
    this.group.add(this.bodyMesh, this.headMesh, makeNameLabel(name, '#8ecbff'));

    this.targetPos = new THREE.Vector3();
    this.targetYaw = 0;
  }

  setState(p, yaw, alive) {
    this.targetPos.set(p[0], p[1], p[2]);
    this.targetYaw = yaw;
    this.group.visible = alive !== 0; // သေဆုံးနေချိန် ဖျောက်
  }

  update(dt) {
    const k = Math.min(1, dt * 10);
    this.group.position.lerp(this.targetPos, k);
    let d = this.targetYaw - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * k;
  }
}

// ---- Net Client ----
export class NetClient {
  constructor({ engine, world, avatar, hud }) {
    this.engine = engine;
    this.world = world;
    this.avatar = avatar;
    this.hud = hud;
    this.remotes = new Map();
    this.myId = null;
    this.connected = false;
    this.sendTimer = 0;
    // StrikeRoom က ချိတ်မည့် callbacks
    this.onHit = null;        // ({dmg, hp, headshot}) — ကိုယ်အထိခံရချိန်
    this.onKilled = null;     // ({byName}) — ကိုယ်သေချိန်
    this.onKillFeedText = null;
    engine.register(this);
  }

  connect(url, { name, token = null } = {}) {
    this.name = name;
    try { this.ws = new WebSocket(url); }
    catch (e) { console.warn('🌐 Server မချိတ်နိုင် — offline mode', e); return; }

    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'hello', name, token }));
    this.ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data));
    this.ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      this.clearRemotes();
      if (was) this.hud.addToast?.('🌐 Server နှင့် အဆက်ပြတ်သွားသည် — offline mode');
      else console.log('🌐 Multiplayer server မတွေ့ပါ — offline mode ဖြင့် ဆက်ကစားနိုင်သည်');
    };
    this.ws.onerror = () => {};
  }

  onMessage(msg) {
    switch (msg.t) {
      case 'welcome':
        this.myId = msg.id;
        this.connected = true;
        this.hud.addToast?.(`🌐 ချိတ်ဆက်ပြီး — #${msg.id} ${msg.name}` +
          (msg.auth === 'cognito' ? ' 🔐 (gwave.cc တရားဝင် login)' : ''));
        break;
      case 'auth_error':
        this.hud.addToast?.(`🔐 Login မအောင်မြင် — ${msg.reason}။ gwave.cc မှ ပြန်ဝင်ပါ`);
        break;
      case 'join':
        this.hud.addToast?.(`👋 ${msg.name} ဝင်ရောက်လာသည်`);
        break;
      case 'leave':
        this.hud.addToast?.(`🚪 ${msg.name} ထွက်သွားသည်`);
        this.removeRemote(msg.id);
        break;
      case 'snapback':
        // Server က ရွေ့လျားမှုကို ငြင်းပယ် — တရားဝင်နေရာသို့ ပြန်ဆွဲ
        this.avatar.teleport(new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]));
        break;
      case 'hit':
        if (msg.target === this.myId) {
          this.onHit?.({ dmg: msg.dmg, hp: msg.hp, headshot: msg.headshot });
        } else if (msg.by === this.myId) {
          this.hud.addToast?.(msg.headshot ? '🎯 ဦးခေါင်းထိမှန်!' : `🎯 ထိမှန် −${msg.dmg}`);
        }
        break;
      case 'kill': {
        const hs = msg.headshot ? ' (ဦးခေါင်း!)' : '';
        this.onKillFeedText?.(`💥 ${msg.byName} ⟶ ${msg.targetName}${hs}`);
        if (msg.target === this.myId) this.onKilled?.({ byName: msg.byName });
        if (msg.board) {
          const top = msg.board.sort((a, b) => b.k - a.k)[0];
          if (top) this.onKillFeedText?.(`🏆 ထိပ်ဆုံး: ${top.n} (${top.k} kills)`);
        }
        break;
      }
      case 'respawn':
        if (msg.id === this.myId) {
          this.avatar.teleport(new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]));
        }
        break;
      case 'snap': {
        const seen = new Set();
        for (const pl of msg.players) {
          if (pl.id === this.myId) continue;
          seen.add(pl.id);
          let r = this.remotes.get(pl.id);
          if (!r) {
            r = new RemotePlayer(pl.id, pl.n);
            this.remotes.set(pl.id, r);
            this.world.current?.group.add(r.group);
            r.group.position.set(pl.p[0], pl.p[1], pl.p[2]);
          }
          r.setState(pl.p, pl.y, pl.a);
        }
        for (const id of [...this.remotes.keys()])
          if (!seen.has(id)) this.removeRemote(id);
        break;
      }
    }
  }

  // PvP — Weapon raycast အတွက် remote player meshes
  getTargetMeshes() {
    const meshes = [];
    for (const r of this.remotes.values())
      if (r.group.visible) meshes.push(r.bodyMesh, r.headMesh);
    return meshes;
  }

  // Server ဆီ hit claim ပို့ — အပြီးသတ်ဆုံးဖြတ်ချက်က server ဘက်မှာ
  sendShoot(targetId, origin, dir) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      t: 'shoot', target: targetId,
      o: [+origin.x.toFixed(2), +origin.y.toFixed(2), +origin.z.toFixed(2)],
      d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)],
    }));
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.group.parent?.remove(r.group);
    this.remotes.delete(id);
  }

  clearRemotes() {
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
  }

  onRoomSwitch() { this.clearRemotes(); }

  update(dt) {
    for (const r of this.remotes.values()) r.update(dt);
    if (!this.connected) return;
    this.sendTimer -= dt;
    if (this.sendTimer <= 0) {
      this.sendTimer = 1 / SEND_HZ;
      const p = this.avatar.group.position;
      this.ws.send(JSON.stringify({
        t: 's',
        r: this.world.current?.id || 'yangon',
        p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        y: +this.avatar.group.rotation.y.toFixed(2),
      }));
    }
  }
}
