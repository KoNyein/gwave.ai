// script/behaviors.js — built-in data-driven behaviors (spec §5.1)
// A behavior is { type, ...params } inside the Behavior component (an array).
// Per-entity scratch lives in entity.state so descriptors stay pure data.

import { System } from "../core/ecs.js";
import { within } from "../physics/physics.js";

export class BehaviorSystem extends System {
  query = ["Transform", "Behavior"];

  constructor({ run, player, physics, audio }) {
    super();
    this.run = run; // actions.run
    this.player = player; // () => player entity | null
    this.physics = physics;
    this.audio = audio;
  }

  fixedUpdate(dt) {
    const player = this.player();
    const pT = player?.get("Transform");
    // tick player i-frames once per step, not per hazard
    const h = player?.get("Health");
    if (h) h.invulnerable = Math.max(0, (h.invulnerable ?? 0) - dt);
    for (const e of this.entities) {
      const t = e.get("Transform");
      for (const b of e.get("Behavior")) {
        this[`_${b.type}`]?.(e, b, t, dt, player, pT);
      }
    }
  }

  // ── ambient motion ───────────────────────────────────────────────────────
  _Rotator(e, b, t, dt) {
    const axis = { x: 0, y: 1, z: 2 }[b.axis ?? "y"] ?? 1;
    t.euler = t.euler ?? [0, 0, 0];
    t.euler[axis] += (((b.speed ?? 90) * Math.PI) / 180) * dt;
  }

  _Floater(e, b, t, dt) {
    e.state.floatT = (e.state.floatT ?? Math.random() * 6) + dt;
    e.state.baseY = e.state.baseY ?? t.pos[1];
    t.pos[1] =
      e.state.baseY + Math.sin(e.state.floatT * (b.freq ?? 1.5)) * (b.amplitude ?? 0.4);
  }

  _MovingPlatform(e, b, t, dt) {
    // seed-compatible dx/dz oscillation plus waypoint mode
    if (Array.isArray(b.waypoints) && b.waypoints.length >= 2) {
      const st = (e.state.mp ??= { i: 0, dir: 1 });
      const target = b.waypoints[st.i];
      const dx = target[0] - t.pos[0];
      const dy = target[1] - t.pos[1];
      const dz = target[2] - t.pos[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.05) {
        st.i += st.dir;
        if (st.i >= b.waypoints.length || st.i < 0) {
          if (b.loop) st.i = (st.i + b.waypoints.length) % b.waypoints.length;
          else {
            st.dir *= -1;
            st.i += st.dir * 2;
          }
        }
      } else {
        const k = Math.min(1, ((b.speed ?? 2) * dt) / d);
        t.pos[0] += dx * k;
        t.pos[1] += dy * k;
        t.pos[2] += dz * k;
      }
    } else {
      e.state.mpT = (e.state.mpT ?? 0) + dt;
      e.state.base = e.state.base ?? [...t.pos];
      const k = Math.sin(e.state.mpT * (b.speed ?? 2) * 0.5);
      t.pos[0] = e.state.base[0] + (b.dx ?? 0) * k;
      t.pos[2] = e.state.base[2] + (b.dz ?? 0) * k;
    }
    this.physics.setKinematicPos(e, t.pos);
  }

  // ── player interaction (sensor-style, transform distance) ────────────────
  _Collectible(e, b, t, dt, player, pT) {
    if (e.state.collected) {
      if ((b.respawn ?? 0) > 0) {
        e.state.hideT -= dt;
        if (e.state.hideT <= 0) {
          e.state.collected = false;
          const m = e.get("MeshRef");
          if (m) m.visible = true;
        }
      }
      return;
    }
    if (!pT || !within(t.pos, pT.pos, b.range ?? 1.3)) return;
    this.world.vars.coins = (this.world.vars.coins ?? 0) + 1;
    this.run(
      [
        { action: "addScore", amount: b.value ?? 10 },
        { action: "playSound", clip: b.sfx ?? "coin" },
      ],
      { entity: e },
    );
    this.world.events.emit("collect", { entity: player, item: e });
    if ((b.respawn ?? 0) > 0) {
      e.state.collected = true;
      e.state.hideT = b.respawn;
      const m = e.get("MeshRef");
      if (m) m.visible = false;
    } else {
      this.world.destroy(e);
    }
  }

  _Hazard(e, b, t, dt, player, pT) {
    if (!pT || !within(t.pos, pT.pos, b.range ?? 1.4)) return;
    this.run([{ action: "damage", amount: b.damage ?? 20 }], { entity: player });
    const kb = b.knock ?? b.knockback ?? 4;
    if (kb && player) {
      const dx = pT.pos[0] - t.pos[0];
      const dz = pT.pos[2] - t.pos[2];
      const d = Math.hypot(dx, dz) || 1;
      player.state.knock = [(dx / d) * kb, 2.2, (dz / d) * kb];
    }
  }

  _Goal(e, b, t, dt, player, pT) {
    if (!pT || this.world.vars.won) return;
    if (!within(t.pos, pT.pos, b.range ?? 1.8)) return;
    this.world.events.emit("goal", { entity: e });
  }

  _Checkpoint(e, b, t, dt, player, pT) {
    if (!pT || e.state.hit) return;
    if (!within(t.pos, pT.pos, b.range ?? 1.8)) return;
    e.state.hit = true;
    this.world.vars.checkpoint = [...pT.pos];
    this.run([
      { action: "showMessage", text: "🚩 Checkpoint" },
      { action: "playSound", clip: "click" },
    ]);
  }

  _TriggerZone(e, b, t, dt, player, pT) {
    if (!pT) return;
    const inside = within(t.pos, pT.pos, b.range ?? 2.2);
    const was = e.state.inside ?? false;
    e.state.inside = inside;
    if (inside && !was) {
      if (b.once && e.state.fired) return;
      e.state.fired = true;
      if (b.message) this.run([{ action: "showMessage", text: `⚡ ${b.message}` }]);
      this.run(b.onEnter, { entity: player });
    } else if (!inside && was) {
      this.run(b.onExit, { entity: player });
    }
  }

  _NPCDialogue(e, b, t, dt, player, pT) {
    // proximity prompt — the interact key is handled by PlayerControlSystem,
    // which reads world.vars.npcNear
    if (!pT) return;
    if (within(t.pos, pT.pos, b.range ?? 2.4)) this.world.vars.npcNear = e;
    else if (this.world.vars.npcNear === e) this.world.vars.npcNear = null;
  }
}

/// Editor palette catalog — the editor writes THESE descriptors into the
/// scene file, the system above reads them. (spec §5.1 table)
export const BEHAVIOR_DEFS = {
  Rotator: { axis: "y", speed: 90 },
  Floater: { amplitude: 0.5, freq: 1 },
  MovingPlatform: { dx: 4, dz: 0, speed: 2 },
  Collectible: { value: 10 },
  Hazard: { damage: 20, knock: 4 },
  Goal: {},
  Checkpoint: {},
  TriggerZone: { message: "Zone entered!", once: false },
  NPCDialogue: { line: "Hello, welcome to gWave!" },
};
