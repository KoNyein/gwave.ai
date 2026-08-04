import { Room, type Client } from "colyseus";

import {
  HEADSHOT_MULT,
  MAP_HALF,
  MAX_HP,
  RESPAWN_S,
  SNAPSHOT_RATE,
  TDM_TARGET,
  TICK_RATE,
  WEAPONS,
  terrainHeight,
  type WeaponId,
} from "@gwave-strike/shared";

import { MatchState, PlayerState } from "../schema/State.js";
import { History, applyInput, type PlayerInput } from "../sim/movement.js";

/// TDM MatchRoom (blueprint §4.2): 16 players max, auto-balanced teams,
/// server-side bots fill empty slots, authoritative movement + hit
/// validation with lag compensation. The client only ever sends inputs and
/// shoot events (origin, dir, seq) — never hit claims.

type ShootMsg = {
  seq: number;
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
  t: number; // client's view timestamp for lag comp
};

type BotBrain = {
  wanderX: number;
  wanderZ: number;
  fireAt: number;
  strafe: number;
};

export class MatchRoom extends Room {
  // Colyseus 0.17: the class generic is the join-options type; state is
  // declared as a typed property instead.
  override state = new MatchState();
  override maxClients = 16;
  private histories = new Map<string, History>();
  private lastFire = new Map<string, number>();
  private respawnAt = new Map<string, number>();
  private bots = new Map<string, BotBrain>();
  private inputs = new Map<string, PlayerInput[]>();

  override onCreate() {
    this.setPatchRate(1000 / SNAPSHOT_RATE);

    this.onMessage("input", (client, batch: PlayerInput[]) => {
      if (!Array.isArray(batch) || batch.length > 12) return;
      const q = this.inputs.get(client.sessionId);
      if (q) q.push(...batch.slice(0, 12));
    });

    this.onMessage("shoot", (client, msg: ShootMsg) => {
      this.handleShoot(client.sessionId, msg);
    });

    this.setSimulationInterval(() => this.tick(), 1000 / TICK_RATE);
    this.ensureBots();
  }

  override onJoin(client: Client, options?: { name?: string }) {
    const blue = [...this.state.players.values()].filter(
      (p) => p.team === 0 && !p.bot,
    ).length;
    const red = [...this.state.players.values()].filter(
      (p) => p.team === 1 && !p.bot,
    ).length;
    const team = blue <= red ? 0 : 1;

    const p = new PlayerState();
    p.id = client.sessionId;
    p.name = String(options?.name ?? "Player").slice(0, 24) || "Player";
    p.team = team;
    this.spawn(p);
    this.state.players.set(client.sessionId, p);
    this.histories.set(client.sessionId, new History());
    this.inputs.set(client.sessionId, []);
    // A human replaces one bot on their team
    this.dropOneBot(team);
  }

  override onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.histories.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.ensureBots();
  }

  // ── Sim tick (30 Hz) ────────────────────────────────────────────────────
  private tick() {
    const now = Date.now();

    // Consume queued human inputs
    for (const [id, queue] of this.inputs) {
      const p = this.state.players.get(id);
      if (!p) continue;
      if (p.hp <= 0) {
        queue.length = 0;
        continue;
      }
      for (const inp of queue) applyInput(p, inp);
      queue.length = 0;
    }

    // Bots
    this.tickBots(now);

    // Histories + respawns
    for (const p of this.state.players.values()) {
      this.histories.get(p.id)?.push(now, p.x, p.y, p.z);
      const rs = this.respawnAt.get(p.id);
      if (p.hp <= 0 && rs !== undefined && now >= rs) {
        this.spawn(p);
        p.hp = MAX_HP;
        p.anim = "idle";
        this.respawnAt.delete(p.id);
      }
    }
  }

  // ── Shooting (server-validated hitscan + lag comp) ─────────────────────
  private handleShoot(shooterId: string, msg: ShootMsg) {
    const shooter = this.state.players.get(shooterId);
    if (!shooter || shooter.hp <= 0) return;
    const stats = WEAPONS[(shooter.weapon as WeaponId) in WEAPONS ? (shooter.weapon as WeaponId) : "rifle"];

    // Fire-rate clamp (anti-cheat basics §4.1)
    const now = Date.now();
    const last = this.lastFire.get(shooterId) ?? 0;
    if (now - last < (60_000 / stats.rpm) * 0.85) return;
    this.lastFire.set(shooterId, now);

    // Origin must be near the shooter's authoritative eye
    const eyeY = shooter.y + 1.55;
    const d2 =
      (msg.ox - shooter.x) ** 2 + (msg.oy - eyeY) ** 2 + (msg.oz - shooter.z) ** 2;
    if (!Number.isFinite(d2) || d2 > 4) return;

    const dl = Math.hypot(msg.dx, msg.dy, msg.dz);
    if (!Number.isFinite(dl) || dl < 0.5) return;
    const dx = msg.dx / dl;
    const dy = msg.dy / dl;
    const dz = msg.dz / dl;

    // Rewind targets to the shooter's view time (clamped inside the buffer)
    const rewindT = Math.max(now - 1000, Math.min(now, msg.t || now));

    let best: { id: string; d: number; head: boolean } | null = null;
    for (const t of this.state.players.values()) {
      if (t.id === shooterId || t.hp <= 0 || t.team === shooter.team) continue;
      const hist = this.histories.get(t.id)?.at(rewindT);
      const tx = hist?.x ?? t.x;
      const ty = hist?.y ?? t.y;
      const tz = hist?.z ?? t.z;
      const head = raySphere(msg.ox, msg.oy, msg.oz, dx, dy, dz, tx, ty + 1.62, tz, 0.2);
      if (head !== null && (!best || head < best.d)) {
        best = { id: t.id, d: head, head: true };
        continue;
      }
      const body = raySphere(msg.ox, msg.oy, msg.oz, dx, dy, dz, tx, ty + 0.95, tz, 0.45);
      if (body !== null && (!best || body < best.d)) {
        best = { id: t.id, d: body, head: false };
      }
    }
    if (!best || best.d > 300) return;

    // Terrain occlusion — coarse march (crates are client feel only)
    for (let s = 2; s < best.d; s += 2) {
      const px = msg.ox + dx * s;
      const py = msg.oy + dy * s;
      const pz = msg.oz + dz * s;
      if (Math.abs(px) > MAP_HALF || Math.abs(pz) > MAP_HALF) return;
      if (py < terrainHeight(px, pz) - 0.2) return;
    }

    const victim = this.state.players.get(best.id);
    if (!victim) return;
    const dmg = Math.round(stats.dmg * (best.head ? HEADSHOT_MULT : 1));
    victim.hp -= dmg;
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.anim = "death";
      victim.deaths += 1;
      shooter.kills += 1;
      if (shooter.team === 0) this.state.scoreBlue += 1;
      else this.state.scoreRed += 1;
      this.respawnAt.set(victim.id, Date.now() + RESPAWN_S * 1000);
      this.pushKill(
        `${shooter.name} ☠ ${victim.name}${best.head ? " (ခေါင်း)" : ""}`,
      );
      if (
        !this.state.over &&
        (this.state.scoreBlue >= TDM_TARGET || this.state.scoreRed >= TDM_TARGET)
      ) {
        this.state.over = true;
        this.pushKill(
          this.state.scoreBlue >= TDM_TARGET ? "🏆 BLUE အနိုင်ရပြီ" : "🏆 RED အနိုင်ရပြီ",
        );
      }
    }
    this.broadcast("hit", { shooter: shooterId, victim: best.id, dmg, head: best.head });
  }

  // ── Bots (server-side port of the Phase 1 client AI) ───────────────────
  private ensureBots() {
    const perTeam = 5;
    for (let team = 0; team <= 1; team++) {
      const have = [...this.state.players.values()].filter(
        (p) => p.team === team,
      ).length;
      for (let i = have; i < perTeam; i++) {
        const id = `bot-${team}-${Math.random().toString(36).slice(2, 7)}`;
        const p = new PlayerState();
        p.id = id;
        p.bot = true;
        p.team = team;
        p.name = team === 0 ? `BLUE-Bot` : `RED-Bot`;
        this.spawn(p);
        this.state.players.set(id, p);
        this.histories.set(id, new History());
        this.bots.set(id, {
          wanderX: p.x,
          wanderZ: p.z,
          fireAt: 0,
          strafe: 1,
        });
      }
    }
  }

  private dropOneBot(team: number) {
    for (const p of this.state.players.values()) {
      if (p.bot && p.team === team) {
        this.state.players.delete(p.id);
        this.bots.delete(p.id);
        this.histories.delete(p.id);
        return;
      }
    }
  }

  private tickBots(now: number) {
    const dt = 1 / TICK_RATE;
    const SPOT = 42;
    const FIRE = 34;
    const SPEED = 3.6;
    for (const [id, brain] of this.bots) {
      const b = this.state.players.get(id);
      if (!b || b.hp <= 0) continue;

      let target: PlayerState | null = null;
      let bestD = SPOT;
      for (const t of this.state.players.values()) {
        if (t.team === b.team || t.hp <= 0) continue;
        const d = Math.hypot(t.x - b.x, t.z - b.z);
        if (d < bestD) {
          bestD = d;
          target = t;
        }
      }

      if (target) {
        b.yaw = Math.atan2(target.x - b.x, target.z - b.z);
        if (bestD > FIRE * 0.7) {
          const dx = (target.x - b.x) / bestD;
          const dz = (target.z - b.z) / bestD;
          b.x += dx * SPEED * dt;
          b.z += dz * SPEED * dt;
          b.anim = "run";
        } else {
          b.x += Math.cos(b.yaw) * brain.strafe * SPEED * 0.6 * dt;
          b.z += -Math.sin(b.yaw) * brain.strafe * SPEED * 0.6 * dt;
          b.anim = "walk";
          if (Math.random() < dt * 0.4) brain.strafe *= -1;
        }
        if (bestD < FIRE && now >= brain.fireAt) {
          brain.fireAt = now + 60_000 / WEAPONS.rifle.rpm + 250 + Math.random() * 300;
          b.anim = "fire";
          // Bot shot resolved like a player shot, with generous miss chance
          if (Math.random() < 0.5) {
            this.handleShoot(id, {
              seq: 0,
              ox: b.x,
              oy: b.y + 1.4,
              oz: b.z,
              dx: target.x - b.x + (Math.random() - 0.5) * bestD * 0.15,
              dy: target.y + 1.0 - (b.y + 1.4) + (Math.random() - 0.5) * bestD * 0.1,
              dz: target.z - b.z + (Math.random() - 0.5) * bestD * 0.15,
              t: now,
            });
          }
        }
      } else {
        if (
          Math.hypot(brain.wanderX - b.x, brain.wanderZ - b.z) < 2 ||
          Math.random() < dt * 0.1
        ) {
          brain.wanderX = (Math.random() * 2 - 1) * (MAP_HALF - 15);
          brain.wanderZ = (Math.random() * 2 - 1) * (MAP_HALF - 15);
        }
        const dx = brain.wanderX - b.x;
        const dz = brain.wanderZ - b.z;
        const l = Math.hypot(dx, dz) || 1;
        b.x += (dx / l) * SPEED * 0.55 * dt;
        b.z += (dz / l) * SPEED * 0.55 * dt;
        b.yaw = Math.atan2(dx, dz);
        b.anim = "walk";
      }
      b.y = terrainHeight(b.x, b.z);
    }
  }

  private spawn(p: PlayerState) {
    p.x = (Math.random() * 2 - 1) * 30;
    p.z = (p.team === 0 ? -1 : 1) * (MAP_HALF - 25 + Math.random() * 10);
    p.y = terrainHeight(p.x, p.z);
  }

  private pushKill(text: string) {
    this.state.killfeed.push(text);
    while (this.state.killfeed.length > 6) this.state.killfeed.shift();
  }
}

/// Ray vs sphere — returns hit distance or null
function raySphere(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  r: number,
): number | null {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return null;
  return tca - Math.sqrt(r * r - d2);
}
