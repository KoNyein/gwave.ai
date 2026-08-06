// script/actions.js — engine actions for the event→action graph (spec §5.3)
// Behaviors call these by name; each is a function of (params) closed over
// the engine context, so graphs stay pure data.

export function createActions(ctx) {
  // ctx: { world, hud, audio, respawn(entity) }
  const A = {
    addScore({ amount = 0 }) {
      ctx.world.vars.score += amount;
      ctx.world.events.emit("scoreChanged", { score: ctx.world.vars.score });
    },
    setVar({ name, value }) {
      if (typeof name === "string") ctx.world.vars[name] = value;
    },
    playSound({ clip, entity }) {
      // Phase 2 — one-shots become positional when an entity is in scope
      const pos = entity?.get("Transform")?.pos;
      if (pos && ctx.audio?.playAt) ctx.audio.playAt(clip, pos);
      else ctx.audio?.play(clip);
    },
    showMessage({ text, seconds = 2.2 }) {
      ctx.hud?.message(String(text ?? ""), seconds);
    },
    destroy({ entity }) {
      if (entity) ctx.world.destroy(entity);
    },
    teleport({ entity, pos }) {
      const t = entity?.get("Transform");
      if (t && Array.isArray(pos)) t.pos = [...pos];
    },
    damage({ entity, amount = 10 }) {
      const h = entity?.get("Health");
      if (!h || h.invulnerable > 0) return;
      h.hp = Math.max(0, h.hp - amount);
      h.invulnerable = 0.8; // brief i-frames so hazards tick, not melt
      const pos = entity?.get("Transform")?.pos;
      if (pos && ctx.audio?.playAt) ctx.audio.playAt("hurt", pos);
      else ctx.audio?.play("hurt");
      ctx.world.events.emit("healthChanged", { entity, hp: h.hp, maxHp: h.maxHp });
      if (h.hp <= 0) ctx.world.events.emit("died", { entity });
    },
    heal({ entity, amount = 10 }) {
      const h = entity?.get("Health");
      if (!h) return;
      h.hp = Math.min(h.maxHp, h.hp + amount);
      ctx.world.events.emit("healthChanged", { entity, hp: h.hp, maxHp: h.maxHp });
    },
    respawn({ entity }) {
      ctx.respawn?.(entity);
    },
    win() {
      ctx.world.events.emit("win", {});
    },
    emit({ event, payload }) {
      if (typeof event === "string") ctx.world.events.emit(event, payload ?? {});
    },
  };

  /** run a list of action descriptors: [{ action: "addScore", … }] */
  function run(list, extra = {}) {
    for (const step of list ?? []) {
      const fn = A[step.action] ?? ctx.pluginActions?.get(step.action);
      if (fn) fn({ ...step, ...extra });
      else console.warn(`[actions] unknown action "${step.action}"`);
    }
  }

  return { actions: A, run };
}
