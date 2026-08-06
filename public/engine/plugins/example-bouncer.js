// plugins/example-bouncer.js — worked plugin example (spec §17, PLUGINS.md)
// Load with:  /engine/?plugin=/engine/plugins/example-bouncer.js
// Adds a "Bouncer" behavior to the editor palette: standing on the object
// launches the player upward — a trampoline.

export function install(api) {
  api.registerBehavior(
    "Bouncer",
    { power: 12, range: 1.4 },
    (entity, b, t, dt, ctx) => {
      const player = ctx.player;
      if (!player) return;
      const pT = player.get("Transform");
      const dx = pT.pos[0] - t.pos[0];
      const dz = pT.pos[2] - t.pos[2];
      const dy = pT.pos[1] - t.pos[1];
      if (dx * dx + dz * dz < (b.range ?? 1.4) ** 2 && dy > 0 && dy < 1.6) {
        player.state.velY = Math.max(player.state.velY ?? 0, b.power ?? 12);
        player.state.grounded = false;
        api.audio.playAt?.("click", t.pos);
      }
    },
  );

  api.registerAction("confetti", ({ text }) => {
    api.hud.message(`🎉 ${text ?? "Party!"}`, 2.5);
  });
}
