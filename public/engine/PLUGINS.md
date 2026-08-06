# gWave Game Engine — Plugin API (Phase 5, spec §17)

Plugins extend the engine **without touching engine source**: new behaviors
show up in the editor palette, new actions become usable in event graphs, and
whole ECS systems can be added.

## Loading a plugin

Same-origin ES module, loaded with the `?plugin=` query param
(comma-separated for several):

```
https://gwave.cc/engine/?plugin=/engine/plugins/example-bouncer.js
```

Or from any module script on the page, using the global surface:

```js
window.gwaveEngine.registerAction("hello", () => alert("hi"));
```

## Plugin shape

Export an `install(api)` function:

```js
export function install(api) {
  api.registerBehavior("Bouncer", { power: 12 }, (entity, b, t, dt, ctx) => {
    // entity  — the ECS entity carrying the behavior
    // b       — the descriptor ({ type:"Bouncer", power, … }) — pure data
    // t       — its Transform component ({ pos, euler, scale })
    // dt      — fixed timestep (1/60)
    // ctx     — { player, world, run, audio, physics }
  });

  api.registerAction("confetti", ({ text }) => {
    api.hud.message(`🎉 ${text}`, 2.5);
  });

  api.registerSystem(new MySystem()); // full ECS system (fixedUpdate/update)
}
```

## The api surface

| Member | ဘာအတွက် |
|--------|---------|
| `registerBehavior(type, defaults, fn)` | editor palette + per-entity fixed tick |
| `registerAction(name, fn)` | event→action graphs (`on: {...}`) |
| `registerSystem(system)` | ECS system with `fixedUpdate/update` |
| `world` / `events` | entities, vars, event bus (`emit/on`) |
| `hud` | `message(text, seconds)`, `banner(text, win)` |
| `audio` | `play(name)`, `playAt(name, pos)` — spatial |

## Worked example

`/engine/plugins/example-bouncer.js` — a trampoline behavior ("Bouncer",
launches the player upward when stood on) plus a `confetti` action. Open:

```
/engine/?plugin=/engine/plugins/example-bouncer.js
```

then add a **Platform**, attach the **Bouncer** behavior from the dropdown,
press **▶ Play** and walk onto it.

## Rules

- Same-origin only — the page CSP blocks cross-origin module loads anyway;
  the loader also refuses them with a readable warning.
- Behavior descriptors must stay **pure data** (JSON-serializable) so scenes
  keep saving/loading; put per-entity runtime state on `entity.state`.
- Don't monkey-patch engine internals — anything not on the api surface may
  change between phases.
