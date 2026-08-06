// gwave-engine-server — authoritative world server for the gWave Game Engine
// (spec §9). Plain ws matching the drone-server pattern: clients send input
// state, the server validates envelopes and broadcasts 20Hz snapshots; remote
// clients interpolate. One room = one world. /health on the same port.
// Run: npm install && node server.js   (port 8789)
import http from "node:http";
import { WebSocketServer } from "ws";

import { verifyToken, authMode } from "./auth.js";

const PORT = process.env.ENGINE_PORT ?? 8789;
const TICK_HZ = 20;
const MAX_SPEED = 12; // m/s envelope (runSpeed 6 + slack)
const MAX_PLAYERS = 24;

const rooms = new Map(); // roomId -> Room

class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map(); // playerId -> player
    this.nextId = 1;
    this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  join(ws, name) {
    const id = this.nextId++;
    const p = {
      id,
      ws,
      name: String(name ?? "").slice(0, 16) || `Player${id}`,
      pos: [0, 1, 4],
      ry: 0,
      anim: "idle",
      lastT: Date.now(),
    };
    this.players.set(id, p);
    send(ws, {
      t: "welcome",
      id,
      room: this.id,
      tickHz: TICK_HZ,
      players: [...this.players.values()].map(pub),
    });
    this.broadcast({ t: "join", p: pub(p) }, id);
    return p;
  }

  leave(id) {
    if (!this.players.delete(id)) return;
    this.broadcast({ t: "leave", id });
    if (this.players.size === 0) {
      clearInterval(this.timer);
      rooms.delete(this.id);
    }
  }

  onState(p, m) {
    const now = Date.now();
    const dt = Math.max(0.02, (now - p.lastT) / 1000);
    p.lastT = now;
    const pos = sane3(m.pos);
    if (pos) {
      const dist = Math.hypot(pos[0] - p.pos[0], pos[1] - p.pos[1], pos[2] - p.pos[2]);
      // envelope validation — teleports snap back (cheap anti-cheat)
      if (dist / dt <= MAX_SPEED * 1.8) p.pos = pos;
      else send(p.ws, { t: "correct", pos: p.pos });
    }
    p.ry = +m.ry || 0;
    p.anim = String(m.anim ?? "idle").slice(0, 12);
  }

  tick() {
    const snap = {
      t: "s",
      p: [...this.players.values()].map((p) => ({
        id: p.id,
        pos: p.pos.map((v) => +v.toFixed(2)),
        ry: +p.ry.toFixed(3),
        a: p.anim,
      })),
    };
    this.broadcast(snap);
  }

  broadcast(msg, exceptId = null) {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
    }
  }
}

const pub = (p) => ({ id: p.id, name: p.name, pos: p.pos, ry: p.ry });
const send = (ws, m) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(m));
};
function sane3(a) {
  if (!Array.isArray(a) || a.length !== 3) return null;
  const v = a.map(Number);
  return v.every((n) => Number.isFinite(n) && Math.abs(n) < 1000) ? v : null;
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "gwave-engine", authMode, rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  let room = null;
  let player = null;
  ws.on("message", async (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m.t === "join" && !player) {
      const user = await verifyToken(m.token);
      if (!user) return send(ws, { t: "authfail", authMode });
      const roomId = String(m.room ?? "world").slice(0, 24);
      if (!rooms.has(roomId)) rooms.set(roomId, new Room(roomId));
      room = rooms.get(roomId);
      if (room.players.size >= MAX_PLAYERS) return send(ws, { t: "full" });
      player = room.join(ws, user.name ?? m.name);
    } else if (player) {
      if (m.t === "u") room.onState(player, m);
      else if (m.t === "chat")
        room.broadcast({
          t: "chat",
          id: player.id,
          name: player.name,
          msg: String(m.msg ?? "").slice(0, 120),
        });
    }
  });
  ws.on("close", () => {
    if (room && player) room.leave(player.id);
  });
});

server.listen(PORT, () =>
  console.log(`[gwave-engine] ws+http on :${PORT} (auth: ${authMode})`),
);
