// plugin/plugin.js — Phase 5 plugin API (spec §17)
// Third-party code extends the engine WITHOUT touching engine source:
// register behaviors (per-entity tick functions), actions (event-graph
// verbs) and whole systems. Plugins load from same-origin URLs via the
// ?plugin=a.js,b.js query param, or by calling window.gwaveEngine directly
// from any <script type="module"> on the page.

import { BEHAVIOR_DEFS } from "../script/behaviors.js";

/// behaviors registered by plugins: type -> { defaults, fn }
export const pluginBehaviors = new Map();
/// actions registered by plugins: name -> fn(params)
export const pluginActions = new Map();

export function createPluginApi({ world, hud, audio, addSystem }) {
  const api = {
    /** engine surface handed to plugin behavior/action functions */
    world,
    events: world.events,
    hud,
    audio,

    /**
     * registerBehavior("Bouncer", { power: 8 }, (entity, b, t, dt, ctx) => {…})
     * — shows up in the editor palette dropdown like a built-in.
     */
    registerBehavior(type, defaults, fn) {
      if (typeof type !== "string" || typeof fn !== "function") return;
      pluginBehaviors.set(type, { defaults: defaults ?? {}, fn });
      BEHAVIOR_DEFS[type] = { ...(defaults ?? {}) }; // editor palette entry
    },

    /** registerAction("shakeCamera", (params) => {…}) — usable in graphs */
    registerAction(name, fn) {
      if (typeof name !== "string" || typeof fn !== "function") return;
      pluginActions.set(name, fn);
    },

    /** registerSystem(instance) — full ECS system with fixedUpdate/update */
    registerSystem(system) {
      return addSystem(system);
    },
  };
  return api;
}

/** load ?plugin=a.js,b.js — same-origin only (CSP enforces it anyway, this
 *  check just gives a readable error instead of a silent CSP block) */
export async function loadUrlPlugins(api) {
  const raw = new URLSearchParams(location.search).get("plugin");
  if (!raw) return;
  for (const spec of raw.split(",")) {
    const url = spec.trim();
    if (!url) continue;
    try {
      const resolved = new URL(url, location.href);
      if (resolved.origin !== location.origin) {
        console.warn(`[plugin] skipped cross-origin plugin ${url}`);
        continue;
      }
      const mod = await import(resolved.href);
      // a plugin exports install(api) — or runs against window.gwaveEngine
      await mod.install?.(api);
      console.log(`[plugin] loaded ${url}`);
    } catch (err) {
      console.warn(`[plugin] failed ${url}`, err);
    }
  }
}
