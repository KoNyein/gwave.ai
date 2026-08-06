// net/net.js — Phase 3 multiplayer client (spec §9)
// Local player state streams up at 20Hz; remote players render as runtime
// entities interpolated ~100ms behind the newest snapshot, so movement is
// smooth at any network jitter. Chat rides the same socket.

import { System } from "../core/ecs.js";

const SEND_HZ = 20;
const INTERP_MS = 100;

export class NetSystem extends System {
  query = []; // manages its own remote map — no component query

  constructor({ world, hud }) {
    super();
    this.worldRef = world;
    this.hud = hud;
    this.ws = null;
    this.id = 0;
    this.connected = false;
    this.remotes = new Map(); // id -> { entity, name, buf:[{t,pos,ry}], anim }
    this.sendT = 0;
    this.playerOf = () => null;
  }

  init() {
    // Stop/Play round-trips destroy every runtime entity — drop dead remotes
    // so the next snapshot rebuilds them fresh instead of writing into ghosts
    this.world.events.on("entityDestroyed", ({ entity }) => {
      for (const [id, r] of this.remotes) {
        if (r.entity === entity) this.remotes.delete(id);
      }
    });
  }

  connect(url, name, room = "world", token = null) {
    try {
      this.ws = new WebSocket(url);
    } catch {
      this.hud.message("Server ချိတ်မရ", 3);
      return;
    }
    this.ws.onopen = () =>
      this.ws.send(JSON.stringify({ t: "join", name, room, token }));
    this.ws.onclose = () => {
      this.connected = false;
      for (const r of this.remotes.values()) this.worldRef.destroy(r.entity);
      this.remotes.clear();
      this.hud.message("Online အဆက်ပြတ်", 3);
    };
    this.ws.onmessage = (e) => this._onMsg(JSON.parse(e.data));
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  _onMsg(m) {
    switch (m.t) {
      case "authfail":
        this.hud.message(`Login လိုသည် (auth: ${m.authMode})`, 3);
        break;
      case "full":
        this.hud.message("Room ပြည့်နေပြီ", 3);
        break;
      case "welcome":
        this.id = m.id;
        this.connected = true;
        this.hud.message(`🌐 Online — room: ${m.room}`, 2.5);
        for (const p of m.players) if (p.id !== this.id) this._addRemote(p);
        break;
      case "join":
        this._addRemote(m.p);
        this.hud.message(`${m.p.name} ဝင်လာပြီ`, 2);
        break;
      case "leave": {
        const r = this.remotes.get(m.id);
        if (r) {
          this.worldRef.destroy(r.entity);
          this.remotes.delete(m.id);
        }
        break;
      }
      case "s": {
        const now = performance.now();
        for (const ps of m.p) {
          if (ps.id === this.id) continue;
          const r = this.remotes.get(ps.id) ?? this._addRemote({ id: ps.id, name: "?" });
          r.buf.push({ t: now, pos: ps.pos, ry: ps.ry });
          if (r.buf.length > 30) r.buf.shift();
          r.anim = ps.a;
        }
        break;
      }
      case "correct": {
        const player = this.playerOf();
        const t = player?.get("Transform");
        if (t && Array.isArray(m.pos)) t.pos = [...m.pos];
        break;
      }
      case "chat":
        this.hud.message(`💬 ${m.name}: ${m.msg}`, 4);
        break;
    }
  }

  _addRemote(p) {
    const e = this.worldRef.createEntity(`net-${p.id}`);
    e.state.runtime = true;
    e.add("Transform", { pos: [...(p.pos ?? [0, 1, 0])], euler: [0, p.ry ?? 0, 0], scale: 1 });
    e.add("MeshRef", { kind: "capsule", color: 0x7de3c3 });
    const r = { entity: e, name: p.name ?? "?", buf: [], anim: "idle" };
    this.remotes.set(p.id, r);
    return r;
  }

  sendChat(msg) {
    if (this.connected && msg) this.ws.send(JSON.stringify({ t: "chat", msg }));
  }

  fixedUpdate(dt) {
    if (!this.connected) return;
    // local → server (20Hz)
    this.sendT += dt;
    if (this.sendT >= 1 / SEND_HZ) {
      this.sendT = 0;
      const player = this.playerOf();
      const t = player?.get("Transform");
      if (t) {
        this.ws.send(
          JSON.stringify({
            t: "u",
            pos: t.pos.map((v) => +v.toFixed(2)),
            ry: +(t.euler?.[1] ?? 0).toFixed(3),
            anim: player.state.animator?.currentName ?? "idle",
          }),
        );
      }
    }
  }

  update() {
    // remote interpolation ~100ms behind newest
    const renderT = performance.now() - INTERP_MS;
    for (const r of this.remotes.values()) {
      const b = r.buf;
      if (b.length < 2) continue;
      let i = b.length - 2;
      while (i > 0 && b[i].t > renderT) i--;
      const A = b[i];
      const B = b[i + 1];
      const span = Math.max(1, B.t - A.t);
      const k = Math.min(1, Math.max(0, (renderT - A.t) / span));
      const t = r.entity.get("Transform");
      t.pos = [
        A.pos[0] + (B.pos[0] - A.pos[0]) * k,
        A.pos[1] + (B.pos[1] - A.pos[1]) * k,
        A.pos[2] + (B.pos[2] - A.pos[2]) * k,
      ];
      t.euler = [0, A.ry + (B.ry - A.ry) * k, 0];
    }
  }

  dispose() {
    this.disconnect();
  }
}
