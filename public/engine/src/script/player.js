// script/player.js — PlayerControlSystem + GameRulesSystem (spec §3.3, §6)
// System ordering (main.js): PlayerControl → Behavior → Physics step →
// GameRules — matches the spec's fixedUpdate ordering.

import { System } from "../core/ecs.js";

export class PlayerControlSystem extends System {
  query = ["Transform", "PlayerController"];

  constructor({ input, physics, followCam, hud, audio }) {
    super();
    this.input = input;
    this.physics = physics;
    this.followCam = followCam;
    this.hud = hud;
    this.audio = audio;
    this.interactCd = 0;
  }

  fixedUpdate(dt) {
    this.interactCd = Math.max(0, this.interactCd - dt);
    for (const e of this.entities) {
      const t = e.get("Transform");
      const pc = e.get("PlayerController");
      const phys = pc.physics ?? {};
      const speed = this.input.run() ? (phys.runSpeed ?? 6) : (phys.moveSpeed ?? 3.4);

      // camera-relative planar move
      const { x: ix, z: iz } = this.input.axis();
      const yaw = this.followCam.yaw;
      let dx = 0;
      let dz = 0;
      const moving = Math.abs(ix) + Math.abs(iz) > 0.02;
      if (moving) {
        dx = ix * Math.cos(yaw) - iz * Math.sin(yaw);
        dz = ix * Math.sin(yaw) + iz * Math.cos(yaw);
        const tgt = Math.atan2(dx, dz);
        t.euler = t.euler ?? [0, 0, 0];
        let d = tgt - t.euler[1];
        d = Math.atan2(Math.sin(d), Math.cos(d));
        t.euler[1] += d * Math.min(1, (phys.turnSpeed ?? 12) * dt);
      }

      // vertical: jump + gravity (controller is kinematic on both backends)
      if (e.state.grounded && this.input.jump()) {
        e.state.velY = phys.jumpForce ?? 7;
        e.state.grounded = false;
        this.audio.play("click");
      }
      e.state.velY = (e.state.velY ?? 0) + (phys.gravity ?? -18) * dt;

      // hazard knockback impulse decays over a few steps
      if (e.state.knock) {
        dx += e.state.knock[0] * 0.16;
        e.state.velY = Math.max(e.state.velY, e.state.knock[1]);
        dz += e.state.knock[2] * 0.16;
        e.state.knock = null;
      }

      const desired = {
        x: dx * speed * dt,
        y: e.state.velY * dt,
        z: dz * speed * dt,
      };
      const res = this.physics.moveCharacter(e, desired);
      if (res) {
        t.pos = res.pos;
        if (res.grounded) {
          e.state.velY = Math.min(0, e.state.velY);
          e.state.grounded = true;
        } else if (e.state.velY < -0.5) {
          e.state.grounded = false;
        }
      }

      // animation state machine: idle ↔ walk ↔ run ↔ jump ↔ fall (spec §6)
      this._anim(e, moving, !e.state.grounded, e.state.velY ?? 0);

      // spatial footsteps — grounded and actually moving
      if (moving && e.state.grounded) {
        e.state.stepT = (e.state.stepT ?? 0) + dt * (this.input.run() ? 1.7 : 1);
        if (e.state.stepT > 0.38) {
          e.state.stepT = 0;
          this.audio.playAt?.("step", t.pos);
        }
      }

      // NPC interact
      const npc = this.world.vars.npcNear;
      if (npc && this.input.interact() && this.interactCd === 0) {
        this.interactCd = 0.6;
        const b = npc.get("Behavior").find((x) => x.type === "NPCDialogue");
        if (b) this.hud.message(`💬 ${b.line}`, 3);
      }
    }
  }

  _anim(e, moving, airborne, velY) {
    const animator = e.state.animator;
    if (!animator) return;
    const want = airborne
      ? velY < -2
        ? "fall"
        : "jump"
      : moving
        ? this.input.run()
          ? "run"
          : "walk"
        : "idle";
    animator.set(want);
  }
}

export class GameRulesSystem extends System {
  query = ["Transform", "PlayerController"];

  constructor({ hud, audio, settings }) {
    super();
    this.hud = hud;
    this.audio = audio;
    this.settings = settings; // { winCondition, coinTotal, surviveSeconds }
    this.over = false;
  }

  init() {
    this.world.events.on("collect", () => {
      if (
        this.settings.winCondition === "collectAll" &&
        this.settings.coinTotal > 0 &&
        (this.world.vars.coins ?? 0) >= this.settings.coinTotal
      ) {
        this._end(true);
      }
    });
    this.world.events.on("goal", () => {
      if (this.settings.winCondition === "reachGoal") this._end(true);
      else this.hud.message("🚩 Goal!");
    });
    this.world.events.on("died", () => this._end(false));
  }

  fixedUpdate() {
    if (this.over) return;
    if (
      this.settings.winCondition === "survive" &&
      this.world.vars.time >= (this.settings.surviveSeconds ?? 30)
    ) {
      this._end(true);
    }
    // fell off the world → back to last checkpoint with a damage tick
    for (const e of this.entities) {
      const t = e.get("Transform");
      if (t.pos[1] < -20) {
        const cp = this.world.vars.checkpoint ?? [0, 1, 0];
        t.pos = [...cp];
        e.state.velY = 0;
        this.world.systems
          .find((s) => s.constructor.name === "BehaviorSystem")
          ?.run([{ action: "damage", amount: 15 }], { entity: e });
      }
    }
  }

  _end(win) {
    if (this.over) return;
    this.over = true;
    this.world.vars.won = win;
    this.hud.banner(win ? "🏆 YOU WIN!" : "💀 GAME OVER", win);
    this.audio.play(win ? "win" : "lose");
    this.world.events.emit(win ? "win" : "lose", {});
  }
}
