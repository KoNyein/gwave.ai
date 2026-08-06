# gWave Metaverse 3D Game Engine — Engineering Spec

**Project:** gWave (gwave.cc) · **Component:** `gwave-engine`
**Type:** Web-first, real-time, multiplayer 3D game engine + world editor
**Standard:** glTF/GLB assets · WebGL2 (WebGPU-ready) · ECS architecture · authoritative-server netcode

> ဒီ document က gWave metaverse game engine ရဲ့ **အသေးစိတ် engineering spec** ပါ။ Engine ဖွဲ့စည်းပုံ၊ module တစ်ခုချင်း၊ physics, scripting, networking, asset pipeline, scene format, editor, API, roadmap — အကုန် ပါတယ်။ MVP code (`world-maker/`, `character/`, `frontend/`) က ဒီ engine ရဲ့ အစ seed ဖြစ်ပြီး၊ ဒီ spec က production-grade အထိ တိုးချဲ့မယ့် အစီအစဉ်ပါ။

---

## 0. Design Goals

| Goal | ရှင်းလင်းချက် |
|------|------|
| **Web-first** | Install မလို — browser မှာ တန်းဆော့လို့ရ (three.js / WebGL2, WebGPU ready) |
| **Data-driven** | Game logic ကို code မဟုတ်ဘဲ **JSON scene + components** နဲ့ တည်ဆောက် — editor နဲ့ ဆွဲလို့ရ |
| **ECS core** | Entity–Component–System — scale ကောင်း၊ behavior ပေါင်းစပ်ရ လွယ် |
| **Multiplayer-native** | Authoritative server (Colyseus) — cheat-resistant, state sync built in |
| **Asset-agnostic** | Generator (image→3D) / Scanner (photo→3D) ကနေ GLB တိုက်ရိုက် ဝင် |
| **Editable in-world** | World Maker editor ↔ Play mode — တစ်ခုတည်း engine, mode ၂ ခု |
| **Extensible** | Plugin + connector hooks — third-party tool/server ချိတ်လို့ရ |

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        gwave-engine                          │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐ │
│  │  Renderer  │  │   Physics  │  │   Scripting│  │  Audio  │ │
│  │ (three.js) │  │  (Rapier)  │  │  (behaviors│  │(Howler/ │ │
│  │            │  │            │  │   + events)│  │ WebAudio│ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────┬────┘ │
│        │               │               │              │      │
│  ┌─────▼───────────────▼───────────────▼──────────────▼────┐ │
│  │                   ECS World (core)                       │ │
│  │   entities · components · systems · event bus           │ │
│  └─────┬───────────────┬───────────────┬──────────────┬────┘ │
│        │               │               │              │      │
│  ┌─────▼────┐   ┌───────▼───┐   ┌───────▼────┐  ┌──────▼────┐ │
│  │  Input   │   │  Camera   │   │  Networking│  │  Assets   │ │
│  │(kb/mouse │   │(1st/3rd/  │   │ (Colyseus  │  │ (GLB/Draco│ │
│  │ /pad/    │   │  orbit)   │   │  client)   │  │  /LOD)    │ │
│  │  touch)  │   │           │   │            │  │           │ │
│  └──────────┘   └───────────┘   └─────┬──────┘  └───────────┘ │
└────────────────────────────────────────┼─────────────────────┘
                                         │ WebSocket
                          ┌──────────────▼───────────────┐
                          │   gwave-server (authoritative)│
                          │   Colyseus rooms · sim tick   │
                          │   state schema · persistence  │
                          └───────────────────────────────┘
```

Engine ကို **client** (browser) နဲ့ **server** (Node/Colyseus) ၂ ပိုင်း ခွဲထား။ Single-player ဆို client-only run လို့ရ၊ multiplayer ဆို server က authoritative။

---

## 2. Runtime & Game Loop

Fixed-timestep simulation + variable-rate render (deterministic physics အတွက်):

```js
const FIXED_DT = 1 / 60;          // physics/logic tick
let acc = 0, last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25); last = now;
  acc += dt;
  input.poll();                    // 1. gather input
  while (acc >= FIXED_DT) {        // 2. fixed update (physics + logic)
    world.fixedUpdate(FIXED_DT);   //    - systems run here
    physics.step(FIXED_DT);        //    - Rapier world.step()
    acc -= FIXED_DT;
  }
  const alpha = acc / FIXED_DT;    // 3. interpolation factor
  world.update(dt);                // 4. variable update (anim, camera)
  renderer.render(scene, camera, alpha); // 5. draw (interpolated)
  requestAnimationFrame(frame);
}
```

- **fixedUpdate:** physics, movement, game rules — deterministic.
- **update:** animation blending, camera smoothing, particle FX — visual.
- **alpha interpolation:** transform တွေကို previous↔current state ကြား lerp — 60Hz physics ကို 144Hz screen မှာ ချောချောပြ။

---

## 3. ECS Core (Entity–Component–System)

Engine ရဲ့ အနှစ်သာရ။ Object တိုင်းက **entity** (id တစ်ခု)၊ data တွေက **component**၊ logic တွေက **system**။

### 3.1 Entity
```js
const e = world.createEntity("crystal_01");
```

### 3.2 Components (data only — no logic)
| Component | Fields |
|-----------|--------|
| `Transform` | position, rotation (quat), scale, parent |
| `MeshRef` | glbUrl / geometry, material, castShadow |
| `RigidBody` | type (dynamic/fixed/kinematic), mass, collider, velocity |
| `Collider` | shape (capsule/box/sphere/mesh), sensor, layer/mask |
| `Character` | rig, animations, physics stats (→ `character-schema.json`) |
| `PlayerController` | inputMap, moveSpeed, jumpForce, camera mode |
| `Behavior` | list of behavior descriptors (see §5) |
| `Health` | hp, maxHp, team, invulnerable |
| `Interactable` | prompt, range, onInteract event |
| `NetSync` | syncTransform, syncAnim, authority |
| `Animator` | mixer, clips, state machine |
| `Audio` | clips, spatial, volume |
| `Light` | type, color, intensity, shadow |
| `Spawn` | isPlayerStart, team, respawn |

### 3.3 Systems (logic — iterate entities with matching components)
```js
class MovementSystem extends System {
  query = ["Transform", "PlayerController", "RigidBody"];
  fixedUpdate(dt) {
    for (const e of this.entities) {
      const pc = e.get("PlayerController");
      const move = input.axis(pc.inputMap);      // camera-relative
      physics.moveCharacter(e, move, dt);        // Rapier char controller
    }
  }
}
```

System ordering (fixedUpdate): `Input → PlayerControl → AI → Physics → Collision/Trigger → GameRules → NetSend`.
Update (render): `Animator → Camera → ParticleFX → HUD`.

### 3.4 Event Bus
Systems တွေ တိုက်ရိုက် မချိတ်ဘဲ event နဲ့ ဆက်သွယ်:
```js
world.events.emit("collect", { entity: player, item: crystal });
world.events.on("collect", ({ item }) => { score += item.value; world.destroy(item); });
```

---

## 4. Physics (Rapier)

**Rapier** (Rust→WASM) — deterministic, fast, browser-ready. `@dimforge/rapier3d-compat` (WASM inline, `await RAPIER.init()`).

### 4.1 World
```js
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const physWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
```

### 4.2 Body ↔ component mapping
| `RigidBody.type` | Rapier | အသုံး |
|------------------|--------|------|
| `dynamic` | `RigidBodyDesc.dynamic()` | falls, pushed (crate, ball) |
| `fixed` | `.fixed()` | ground, walls, static props |
| `kinematicPosition` | `.kinematicPositionBased()` | moving platforms, characters |

Colliders: `cuboid / ball / capsule / trimesh` — `ColliderDesc`. Sensor (trigger) = `.setSensor(true)`.

### 4.3 Character Controller (KinematicCharacterController)
```js
const controller = physWorld.createCharacterController(0.02);
controller.enableAutostep(0.4, 0.2, true);   // stairs
controller.enableSnapToGround(0.5);          // slopes
controller.setApplyImpulsesToDynamicBodies(true); // push crates

// per tick:
controller.computeColliderMovement(charCollider, desired);
const mv = controller.computedMovement();
body.setNextKinematicTranslation({ x:p.x+mv.x, y:p.y+mv.y, z:p.z+mv.z });
const grounded = controller.computedGrounded();
```

### 4.4 Collision layers
Bitmask groups — player / enemy / prop / trigger / ground — အလွှာလိုက် interaction ထိန်း (ဥပမာ trigger က player ကိုပဲ detect)။

> **Fallback:** Rapier load မရရင် (rare) engine က kinematic AABB physics-lite (MVP world-maker ထဲက) ကို auto-fallback — game ရပ်မသွား။

---

## 5. Behavior / Scripting System (data-driven)

Game logic ကို **behavior descriptor** (JSON) နဲ့ ဖွဲ့ — editor မှာ ဆွဲထည့်လို့ရ၊ code မလို။

### 5.1 Built-in behaviors
| Behavior | Params | အလုပ် |
|----------|--------|------|
| `Rotator` | axis, speed | ဆက်လှည့် |
| `Floater` | amplitude, freq | အပေါ်အောက် ယိမ်း |
| `MovingPlatform` | waypoints[], speed, loop | လမ်းကြောင်းအတိုင်း ရွေ့ |
| `Collectible` | value, sfx, respawn | ထိ→ပျောက်→score+ |
| `Hazard` | damage, knockback | ထိ→hp လျော့ |
| `Goal` | nextWorld / win | ထိ→အောင် (level ပြီး) |
| `Checkpoint` | id | ဖြတ်→respawn point သိမ်း |
| `Door` | requiresKey, openEvent | trigger→ဖွင့် |
| `TriggerZone` | onEnter, onExit, once | invisible box→event |
| `NPCDialogue` | lines[], onEnd | interact→စကားပြော |
| `Spawner` | prefab, rate, max | enemy/item ထုတ် |
| `Button/Lever` | targetId, toggle | interact→target ကို signal |

### 5.2 Descriptor + event→action graph
```jsonc
{
  "behaviors": [
    { "type": "Collectible", "value": 10, "sfx": "coin", "respawn": 0 },
    { "type": "Rotator", "axis": "y", "speed": 90 }
  ],
  "on": {                         // event → actions (visual scripting)
    "collect": [
      { "action": "addScore", "amount": 10 },
      { "action": "playSound", "clip": "coin" },
      { "action": "emit", "event": "checkWinCondition" }
    ]
  }
}
```

### 5.3 Actions (engine-provided)
`addScore, setVar, playSound, playAnim, spawn, destroy, teleport, showMessage, openDoor, damage, heal, loadWorld, emit, wait, if`.

### 5.4 Optional JS scripting (advanced)
Sandboxed component for power users:
```js
world.defineScript("PatrolAI", {
  onSpawn(e) { e.state.target = randomPoint(); },
  fixedUpdate(e, dt) { moveToward(e, e.state.target, dt);
    if (reached(e)) e.state.target = randomPoint(); }
});
```
Sandbox: no DOM/network access; only engine API surface.

---

## 6. Character & Avatar System

`Character` component ← `character/character-schema.json` (rig, animations, physics, camera, stats, interaction, spawn, lod, network).

- **Auto-rig pipeline:** generated/scanned mesh → UniRig/Mixamo humanoid skeleton → shared animation library retarget (idle/walk/run/jump). See `ARCHITECTURE.md §7b`.
- **Animator state machine:** `idle ↔ walk ↔ run ↔ jump ↔ fall`, blend trees, root-motion optional.
- **VRM support:** avatar standard (VRoid) — first-class humanoid.
- **NPC vs Player:** same component; `PlayerController` vs `AIController` drives it.

---

## 7. Input System

Abstraction over devices → **actions** (rebindable):
```js
input.map({
  moveX: ["KeyD:+", "KeyA:-", "Gamepad.LX", "Joystick.x"],
  moveZ: ["KeyS:+", "KeyW:-", "Gamepad.LY", "Joystick.y"],
  jump:  ["Space", "Gamepad.A", "TouchButton.jump"],
  run:   ["ShiftLeft", "Gamepad.RB"],
  interact: ["KeyE", "Gamepad.X"]
});
```
Devices: keyboard, mouse, **gamepad (Gamepad API)**, **mobile touch (joystick + buttons)**. Same game code works across all.

---

## 8. Camera System

Modes (per `Character.camera`): `thirdPerson` (spring-arm, collision-aware), `firstPerson` (eye-height), `orbit` (editor/free), `cinematic` (path/rails).
Features: smoothing (lerp), zoom, occlusion pull-in (wall ကြားဆို ကင်မရာ နီးလာ), shoulder offset, FOV kick on sprint.

---

## 9. Networking / Multiplayer (Colyseus)

**Authoritative server** — client input ပို့, server simulate, state broadcast.

### 9.1 Model
```
Client: sample input ──► Server: validate + simulate (fixed tick)
Client: predict locally           │
Client: interpolate remote  ◄──── Server: broadcast state snapshot
Client: reconcile on mismatch
```

- **Client prediction** (local player) + **server reconciliation** — latency ဖုံး။
- **Entity interpolation** (remote players) — ~100ms buffer, ချောချော။
- **State schema** (Colyseus `@type`): only synced components (`NetSync`) go over wire; delta-compressed.
- **Area of interest:** ဝေးတဲ့ entity မ sync — bandwidth ချွေ။
- **Authority:** server (default) or owner (for props).

### 9.2 Room = World
Colyseus room တစ်ခု = metaverse world/level တစ်ခု။ Join/leave, chat, voice (WebRTC) hooks။

---

## 10. Asset Pipeline

```
[Generator: image→GLB]  ┐
[Scanner: photo→GLB]    ├─► import ─► normalize ─► [Draco compress] ─► [auto-LOD]
[Marketplace/Sketchfab] ┘                              │                   │
                                                       ▼                   ▼
                                              S3 + CloudFront  ◄── asset registry (DB)
                                                       │
                                                  runtime GLTFLoader (+DracoLoader, +KTX2)
```

- **Formats:** GLB (mesh+mat+anim), Draco (geometry compress), KTX2/Basis (texture compress), VRM (avatar).
- **LOD:** auto-generate LOD0/1/2 (simplify) — crowd performance.
- **Instancing:** same asset ×N → GPU instancing (forests, props).
- **Streaming:** distance-based load/unload; `cullDistance` per asset.

---

## 11. World / Scene File Format (`.gwave.json`)

Editor save + engine load. Extends the MVP world-maker save format:
```jsonc
{
  "version": 2,
  "name": "Crystal Caverns",
  "env": { "preset": "night", "fog": [40,120], "skybox": "hdri/cave.hdr" },
  "gravity": [0, -9.81, 0],
  "settings": { "maxPlayers": 16, "respawn": true, "winCondition": "collectAll" },
  "assets": [ { "id":"crystal", "glb":"/outputs/abc.glb", "lod":true, "draco":true } ],
  "entities": [
    {
      "id": "crystal_01", "asset": "crystal",
      "transform": { "pos":[3,1,0], "rot":[0,0,0,1], "scale":1 },
      "components": {
        "RigidBody": { "type":"fixed", "collider":"mesh", "sensor":true },
        "Behavior": [ { "type":"Collectible", "value":10 }, { "type":"Rotator","axis":"y","speed":90 } ]
      }
    },
    { "id":"player_start", "components": { "Spawn": { "isPlayerStart":true } },
      "transform": { "pos":[0,0,0] } }
  ]
}
```
Backward-compatible loader upgrades v1 (world-maker) → v2 automatically.

---

## 12. Editor (World Maker) Integration

Editor နဲ့ engine က **တစ်ခုတည်း codebase, mode ၂ ခု** —
- **Edit mode:** TransformControls (move/rotate/scale), object library, hierarchy, properties, behavior panel, save/load JSON.
- **Play mode:** full engine runtime (ECS+physics+scripting) — ကိုယ်ဆောက်တဲ့ world ကို ချက်ချင်း test။
- **Live-edit:** play နေရင်း component tweak → hot-apply (Phase 3).
- Current MVP: `world-maker/index.html` = Edit↔Play seed. Game-engine layer = behaviors + Rapier + game-state HUD ထည့်။

---

## 13. HUD / Game UI System

Data-driven overlay: score, coins, health bar, timer, minimap, objective, dialogue box, win/lose banner. React (or lightweight DOM) bound to ECS game-state — engine emits, HUD renders. Themeable (brand skin).

---

## 14. Audio System

WebAudio (Howler.js wrapper): 2D UI SFX + **3D spatial audio** (positional, per-entity `Audio` component), music layers, distance attenuation, doppler (optional).

---

## 15. Persistence & Save

- **World data:** `.gwave.json` in Postgres (`scenes` table) + assets in S3.
- **Player progress:** save slots (position, inventory, stats) per user.
- **Multiplayer:** server-authoritative state snapshot + periodic DB flush.

---

## 16. Performance Budget & Techniques

| Technique | ဘာအတွက် |
|-----------|---------|
| Fixed-timestep + interpolation | smooth on any refresh rate |
| GPU instancing | same-mesh crowds |
| Auto-LOD + frustum/occlusion cull | draw-call ချ |
| Draco + KTX2 | download/VRAM ချ |
| Object pooling | GC spike ချ (bullets, FX) |
| Web Workers | physics/pathfinding off main thread (future) |
| Area-of-interest netcode | bandwidth ချ |

Target: 60fps @ mid-range laptop / modern phone; graceful degrade.

---

## 17. Connector / Extensibility Hooks

- **Plugin API:** register components, behaviors, actions, systems, importers.
- **Connector hooks (→ platform §7):** asset import (Sketchfab), export (Unity/Unreal/USDZ), webhooks (world events → external server), OAuth ("Connect with gWave"), REST/GraphQL for scene CRUD.
- **Server plugins:** custom room logic, matchmaking, anti-cheat rules.

---

## 18. Directory / Module Layout (target)

```
gwave-engine/
├── src/
│   ├── core/         ecs (entity, component, system, events), loop
│   ├── render/       three.js renderer, materials, postFX
│   ├── physics/      rapier world, character controller, layers
│   ├── script/       behaviors/, actions/, event-graph, sandbox
│   ├── character/    animator, rig, avatar (vrm)
│   ├── input/        devices, action-map
│   ├── camera/       thirdPerson, firstPerson, orbit
│   ├── net/          colyseus client, prediction, interpolation
│   ├── assets/       gltf loader, draco, ktx2, lod, registry
│   ├── audio/        webaudio/howler spatial
│   ├── ui/           hud, dialogue, menus
│   └── serialize/    .gwave.json load/save, migrations
├── editor/           world maker (edit + play)  ← world-maker/ evolves here
├── server/           colyseus rooms, schema, persistence
└── examples/         platformer, collect-a-thon, social-hub
```

---

## 19. Public API Sketch

```js
import { Engine } from 'gwave-engine';

const engine = new Engine({ canvas, mode: 'play' });
await engine.init();                       // loads Rapier, renderer
const world = await engine.loadWorld('/scenes/caverns.gwave.json');

world.onEvent('win', () => engine.ui.banner('You win!'));
engine.connect('wss://gwave.cc/room/caverns');  // go multiplayer
engine.start();

// runtime authoring
const e = world.spawn('crystal', { pos:[5,1,2] });
e.addBehavior({ type:'Collectible', value: 25 });
```

---

## 20. Implementation Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **0** | Editor + play mode + kinematic physics + character (MVP) | ✅ `world-maker/`, `character/` |
| **1** | ECS core refactor + Rapier physics + behavior/event system + game-state HUD | ⏳ next code scaffold |
| **2** | Animator state machine + auto-rig pipeline + audio + full input (gamepad/touch) | |
| **3** | Colyseus multiplayer (prediction/interp) + rooms + chat | |
| **4** | Asset pipeline (Draco/LOD/KTX2) + streaming + scanner assets | |
| **5** | Plugin API + connectors (import/export/webhooks) + marketplace | |
| **6** | WebGPU renderer path + Web Worker physics + mobile polish | |

---

## 21. Tech Stack Summary

| Layer | Tech |
|-------|------|
| Render | three.js (WebGL2 → WebGPU) |
| Physics | Rapier (`@dimforge/rapier3d-compat`) |
| ECS | custom (or `bitecs` for perf) |
| Netcode | Colyseus (WebSocket) + custom prediction |
| Assets | glTF/GLB, Draco, KTX2/Basis, VRM |
| Audio | Howler.js / WebAudio |
| Editor UI | React + react-three-fiber + drei |
| Server | Node.js + Colyseus + Postgres + Redis |
| Build | Vite + TypeScript |

---

*gWave Metaverse 3D Game Engine — engineering spec. Seed code: `world-maker/`, `character/`, `frontend/`. Companion docs: `ARCHITECTURE.md` (platform), `character/character-schema.json` (character data model).*
