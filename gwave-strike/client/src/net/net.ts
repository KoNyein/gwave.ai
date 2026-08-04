import * as Colyseus from "colyseus.js";

/// Colyseus client (blueprint §4.1): inputs 60/s (batched per frame),
/// state snapshots consumed via schema patches. Prediction runs locally
/// (the Phase 1 controller IS the predictor — same shared constants);
/// reconciliation is a soft position pull toward the authoritative state
/// when divergence passes a threshold, replaying is not needed because the
/// server integrates our exact inputs in order (lastSeq tells us how far).

export type RemoteView = {
  id: string;
  name: string;
  team: number;
  bot: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  anim: string;
  t: number; // arrival time for interpolation
};

export type NetEvents = {
  onKill(text: string): void;
  onHit(victimIsMe: boolean, dmg: number, iAmShooter: boolean, head: boolean): void;
  onScore(blue: number, red: number): void;
};

type PlayerLike = {
  id: string;
  name: string;
  team: number;
  bot: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  anim: string;
  lastSeq: number;
  listen?: unknown;
};

export class Net {
  room: Colyseus.Room | null = null;
  meId = "";
  myTeam = 0;
  myHp = 100;
  myServerPos = { x: 0, y: 0, z: 0, seq: 0 };
  /// snapshot buffers per remote id for 100ms-in-the-past interpolation
  remotes = new Map<string, RemoteView[]>();
  private seq = 1;
  private batch: unknown[] = [];
  private killfeedSeen = 0;

  async connect(url: string, events: NetEvents): Promise<boolean> {
    try {
      const client = new Colyseus.Client(url);
      const room = await client.joinOrCreate("match", { name: playerName() });
      this.room = room;
      this.meId = room.sessionId;

      room.onStateChange((state: unknown) => {
        const s = state as {
          players: Map<string, PlayerLike> & {
            forEach(cb: (p: PlayerLike, id: string) => void): void;
          };
          scoreBlue: number;
          scoreRed: number;
          killfeed: { length: number; at?(i: number): string; [i: number]: string };
        };
        const now = performance.now();
        s.players.forEach((p, id) => {
          if (id === this.meId) {
            this.myTeam = p.team;
            this.myHp = p.hp;
            this.myServerPos = { x: p.x, y: p.y, z: p.z, seq: p.lastSeq };
            return;
          }
          let buf = this.remotes.get(id);
          if (!buf) {
            buf = [];
            this.remotes.set(id, buf);
          }
          buf.push({
            id,
            name: p.name,
            team: p.team,
            bot: p.bot,
            x: p.x,
            y: p.y,
            z: p.z,
            yaw: p.yaw,
            hp: p.hp,
            anim: p.anim,
            t: now,
          });
          while (buf.length > 12) buf.shift();
        });
        // prune remotes that left
        for (const id of [...this.remotes.keys()]) {
          let found = false;
          s.players.forEach((_p, pid) => {
            if (pid === id) found = true;
          });
          if (!found) this.remotes.delete(id);
        }
        events.onScore(s.scoreBlue, s.scoreRed);
        const kf = s.killfeed;
        for (let i = this.killfeedSeen; i < kf.length; i++) {
          const line = kf.at ? kf.at(i) : kf[i];
          if (line) events.onKill(line);
        }
        this.killfeedSeen = kf.length;
      });

      room.onMessage(
        "hit",
        (m: { shooter: string; victim: string; dmg: number; head: boolean }) => {
          events.onHit(m.victim === this.meId, m.dmg, m.shooter === this.meId, m.head);
        },
      );
      return true;
    } catch {
      return false;
    }
  }

  /// Queue this frame's input; flushed once per frame (≤60/s)
  sendInput(dt: number, f: number, s: number, run: boolean, crouch: boolean, yaw: number, pitch: number) {
    if (!this.room) return;
    this.batch.push({ seq: this.seq++, dt, f, s, run, crouch, yaw, pitch });
    if (this.batch.length >= 1) {
      this.room.send("input", this.batch);
      this.batch = [];
    }
  }

  shoot(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) {
    this.room?.send("shoot", {
      seq: this.seq,
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      t: Date.now() - 80, // ~interp delay — server clamps inside its buffer
    });
  }

  /// Interpolated view of a remote 100ms in the past
  sample(id: string): RemoteView | null {
    const buf = this.remotes.get(id);
    if (!buf || buf.length === 0) return null;
    const target = performance.now() - 100;
    let a = buf[0]!;
    let b = buf[buf.length - 1]!;
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i]!.t <= target && buf[i + 1]!.t >= target) {
        a = buf[i]!;
        b = buf[i + 1]!;
        break;
      }
    }
    const span = b.t - a.t || 1;
    const k = Math.max(0, Math.min(1, (target - a.t) / span));
    return {
      ...b,
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      z: a.z + (b.z - a.z) * k,
      yaw: a.yaw + shortestAngle(a.yaw, b.yaw) * k,
    };
  }
}

function shortestAngle(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function playerName(): string {
  try {
    const saved = localStorage.getItem("strike:name");
    if (saved) return saved;
    const n = `Player-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem("strike:name", n);
    return n;
  } catch {
    return "Player";
  }
}
