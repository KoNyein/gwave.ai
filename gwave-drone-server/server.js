// server/server.js — GWAVE authoritative game server (P5 core)
// Transport: WebSocket (ws) — production upgrade: WebTransport datagrams (QUIC)
//   → transport layer ကို sendTo/broadcast function ၂ ခုထဲမှာသာသုံးထားလို့ swap လွယ်
// Run: cd server && npm install && node server.js   (port 8787)
import { WebSocketServer } from 'ws';
import { verifyToken, authMode } from './auth.js';

const API_URL = process.env.API_URL ?? 'http://localhost:8788';
const GAME_KEY = process.env.GAME_KEY ?? 'dev-key';
async function reportStats(sub, delta) {
  if (!sub) return;
  try {
    await fetch(API_URL + '/report', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-game-key': GAME_KEY },
      body: JSON.stringify({ sub, ...delta }) });
  } catch (_) { /* api offline — skip */ }
}

const PORT = process.env.PORT ?? 8787;
const TICK_HZ = 30;                 // snapshot broadcast
const HISTORY_MS = 300;             // lag-comp rewind buffer
const MAX_SPEED = { soldier: 8.5, drone: 55 };   // envelope validation (m/s)

const wss = new WebSocketServer({ port: PORT });
console.log(`[gwave-server] ws://0.0.0.0:${PORT} (auth: ${authMode})`);

const rooms = new Map();            // roomId → Room

class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map();       // playerId → Player
    this.nextId = 1;
    this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  join(ws, name) {
    const id = this.nextId++;
    const p = {
      id, ws, name: String(name).slice(0, 16) || 'Pilot' + id,
      mode: 'SOLDIER',              // SOLDIER | DRONE
      pos: [2 + id, 0, 8], yaw: 0, pitch: 0,
      dronePos: [0, 0, 0], droneQuat: [0, 0, 0, 1],
      anim: 'IDLE', hp: 100, alive: true,
      kills: 0, deaths: 0,
      lastT: Date.now(),
      history: [],                  // [{t, pos}] lag comp
    };
    this.players.set(id, p);
    send(ws, { t: 'welcome', id, room: this.id, tickHz: TICK_HZ,
      players: [...this.players.values()].map(pub) });
    this.broadcast({ t: 'join', p: pub(p) }, id);
    console.log(`[${this.id}] ${p.name} joined (#${id}) — ${this.players.size} players`);
    return p;
  }

  leave(id) {
    if (!this.players.delete(id)) return;
    this.broadcast({ t: 'leave', id });
    if (this.players.size === 0) {
      clearInterval(this.timer);
      rooms.delete(this.id);
      console.log(`[${this.id}] room closed`);
    }
  }

  // client state update — envelope validation
  onState(p, m) {
    const now = Date.now();
    const dt = Math.max(0.02, (now - p.lastT) / 1000);
    p.lastT = now;
    const pos = sane3(m.pos), dpos = sane3(m.dronePos);
    if (pos) {
      const dist = Math.hypot(pos[0] - p.pos[0], pos[1] - p.pos[1], pos[2] - p.pos[2]);
      if (dist / dt <= MAX_SPEED.soldier * 1.6) p.pos = pos;       // cheat bound
      else send(p.ws, { t: 'correct', pos: p.pos });               // reject → snap back
    }
    if (dpos && m.mode === 'DRONE') {
      const dist = Math.hypot(dpos[0] - p.dronePos[0], dpos[1] - p.dronePos[1], dpos[2] - p.dronePos[2]);
      if (dist / dt <= MAX_SPEED.drone * 1.6) p.dronePos = dpos;
    }
    if (Array.isArray(m.droneQuat) && m.droneQuat.length === 4) p.droneQuat = m.droneQuat.map(Number);
    p.yaw = +m.yaw || 0; p.pitch = +m.pitch || 0;
    p.mode = m.mode === 'DRONE' ? 'DRONE' : 'SOLDIER';
    p.anim = String(m.anim ?? 'IDLE').slice(0, 12);
    // history for lag comp
    p.history.push({ t: now, pos: [...p.pos] });
    while (p.history.length && p.history[0].t < now - HISTORY_MS) p.history.shift();
  }

  // shoot event — server-side hit validation with rewind
  onShoot(p, m) {
    const now = Date.now();
    const rewindT = now - Math.min(250, Math.max(0, +m.lagMs || 0));
    this.broadcast({ t: 'shot', id: p.id, from: sane3(m.from), to: sane3(m.to) }, p.id);
    const targetId = +m.hit;
    if (!targetId) return;
    const target = this.players.get(targetId);
    if (!target || !target.alive || targetId === p.id) return;
    // rewind: target ရဲ့ claim အချိန်က position
    const hist = target.history.find(h => h.t >= rewindT) ?? target.history.at(-1);
    const tpos = hist?.pos ?? target.pos;
    const from = sane3(m.from), to = sane3(m.to);
    if (!from || !to) return;
    // claim point ↔ rewound position အကွာ 1.2m အတွင်း = valid
    const d = Math.hypot(to[0] - tpos[0], to[2] - tpos[2]);
    const dy = to[1] - tpos[1];
    if (d > 1.2 || dy < -0.5 || dy > 2.2) return;                  // reject
    const dmg = Math.min(105, Math.max(1, +m.dmg || 20));
    target.hp -= dmg;
    this.broadcast({ t: 'hit', id: targetId, by: p.id, dmg, hp: target.hp });
    if (target.hp <= 0) {
      target.alive = false;
      target.deaths++; p.kills++;
      reportStats(p.sub, { kills: 1 });                 // task 7.5 stats
      reportStats(target.sub, { deaths: 1 });
      this.broadcast({ t: 'kill', victim: targetId, by: p.id,
        board: this.board() });
      // respawn 3s
      setTimeout(() => {
        if (!this.players.has(targetId)) return;
        target.hp = 100; target.alive = true;
        target.pos = [(Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30];
        this.broadcast({ t: 'respawn', id: targetId, pos: target.pos });
      }, 3000);
    }
  }

  board() {
    return [...this.players.values()]
      .map(p => ({ id: p.id, name: p.name, k: p.kills, d: p.deaths }))
      .sort((a, b) => b.k - a.k);
  }

  tick() {
    const snap = {
      t: 's',
      p: [...this.players.values()].map(p => ({
        id: p.id, m: p.mode === 'DRONE' ? 1 : 0,
        pos: r3(p.pos), yaw: r2(p.yaw), pitch: r2(p.pitch),
        dp: p.mode === 'DRONE' ? r3(p.dronePos) : undefined,
        dq: p.mode === 'DRONE' ? p.droneQuat.map(v => +v.toFixed(3)) : undefined,
        a: p.anim, hp: p.hp,
      })),
    };
    this.broadcast(snap);
  }

  broadcast(msg, exceptId = null) {
    const data = JSON.stringify(msg);
    for (const p of this.players.values())
      if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
  }
}

function pub(p) { return { id: p.id, name: p.name, pos: p.pos, hp: p.hp, mode: p.mode }; }
function send(ws, m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }
function sane3(a) {
  if (!Array.isArray(a) || a.length !== 3) return null;
  const v = a.map(Number);
  return v.every(n => Number.isFinite(n) && Math.abs(n) < 2000) ? v : null;
}
const r3 = a => a.map(v => +v.toFixed(2));
const r2 = v => +(+v).toFixed(3);

wss.on('connection', ws => {
  let room = null, player = null;
  ws.on('message', async raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join' && !player) {
      const user = await verifyToken(m.token);          // gwave Cognito SSO (task 7.1)
      if (!user) return send(ws, { t: 'authfail', authMode });
      const roomId = String(m.room ?? 'valley').slice(0, 24);
      if (!rooms.has(roomId)) rooms.set(roomId, new Room(roomId));
      room = rooms.get(roomId);
      if (room.players.size >= 16) return send(ws, { t: 'full' });
      player = room.join(ws, user.name ?? m.name);
      player.sub = user.sub;
    } else if (player) {
      if (m.t === 'u') room.onState(player, m);
      else if (m.t === 'shoot') room.onShoot(player, m);
      else if (m.t === 'chat') room.broadcast({ t: 'chat', id: player.id,
        name: player.name, msg: String(m.msg).slice(0, 120) });
      else if (m.t === 'boom') room.broadcast({ t: 'boom',
        pos: sane3(m.pos), radius: Math.min(8, +m.radius || 6) }, player.id);
    }
  });
  ws.on('close', () => { if (room && player) room.leave(player.id); });
});
