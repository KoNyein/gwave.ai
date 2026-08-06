// main.js — gwave-engine boot: ECS world + fixed-timestep loop + editor
// (spec §2, §19). Edit mode = authoring; ▶ Play snapshots the scene, adds a
// player + physics bodies, runs the systems; ■ Stop restores the snapshot.

import * as THREE from "three";

import { World } from "./core/ecs.js";
import { startLoop, FIXED_DT } from "./core/loop.js";
import { createPhysics } from "./physics/physics.js";
import { createActions } from "./script/actions.js";
import { BehaviorSystem } from "./script/behaviors.js";
import { PlayerControlSystem, GameRulesSystem } from "./script/player.js";
import { createStage, RenderSystem, configureLoaders } from "./render/renderer.js";
import { createInput } from "./input/input.js";
import { createFollowCam } from "./camera/camera.js";
import { createHud } from "./ui/hud.js";
import { createAudio3d } from "./audio/audio3d.js";
import { createEditor } from "./editor/editor.js";
import { NetSystem } from "./net/net.js";
import { createPluginApi, loadUrlPlugins, pluginActions } from "./plugin/plugin.js";
import { saveScene } from "./serialize/scene.js";

const $ = (id) => document.getElementById(id);
const canvas = $("c");

const world = new World();
const { renderer, scene, applyEnv, resize } = createStage(canvas);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1000);
camera.position.set(8, 7, 10);

configureLoaders(renderer); // Phase 4 — Draco + KTX2 on the shared loader
const renderSystem = new RenderSystem(scene, camera);
world.addSystem(renderSystem);

const input = createInput();
const followCam = createFollowCam(camera, canvas);
const hud = createHud(world);
const audio = createAudio3d();

const physics = await createPhysics();
$("phys-chip").textContent = `physics: ${physics.kind}`;

const { run } = createActions({
  world,
  hud,
  audio,
  pluginActions,
  respawn: (e) => {
    const t = e?.get("Transform");
    if (t) t.pos = [...(world.vars.checkpoint ?? [0, 1, 0])];
  },
});

const editor = createEditor({ world, renderSystem, camera, canvas, applyEnv });

// ── Phase 5 plugin API (spec §17) — window.gwaveEngine + ?plugin= loader ──
const pluginApi = createPluginApi({
  world,
  hud,
  audio,
  addSystem: (sys) => world.addSystem(sys),
});
window.gwaveEngine = pluginApi;
void loadUrlPlugins(pluginApi);

// ── play / stop ────────────────────────────────────────────────────────────
let playing = false;
let snapshot = null;
let playerEntity = null;
let playSystems = [];

function solidSize(e) {
  // physics size from the rendered bounds — good enough for fixed props
  const obj = renderSystem.objectFor(e);
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  return [Math.max(0.1, s.x), Math.max(0.1, s.y), Math.max(0.1, s.z)];
}

const PASS_THROUGH = new Set(["Collectible", "TriggerZone", "Goal", "Checkpoint", "NPCDialogue"]);

function startPlay() {
  snapshot = saveScene(world, editor.meta());
  editor.setPlaying(true);

  // solid physics bodies for editor entities (sensors stay distance-based)
  for (const e of editor.editorEntities()) {
    const behaviors = e.get("Behavior") ?? [];
    if (behaviors.some((b) => PASS_THROUGH.has(b.type))) continue;
    if (e.get("MeshRef").isCharacter) continue;
    const rb = e.get("RigidBody");
    if (rb && rb.type === "none") continue;
    const t = e.get("Transform");
    const size = solidSize(e);
    const isPlatform = behaviors.some((b) => b.type === "MovingPlatform");
    physics.addBody(e, [t.pos[0], t.pos[1], t.pos[2]], {
      type: isPlatform ? "kinematicPosition" : (rb?.type ?? "fixed"),
      size,
    });
  }

  // player — authored ★ character or a capsule placeholder
  const authored = editor
    .editorEntities()
    .find((e) => e.get("Character")?.isPlayerStart);
  playerEntity = world.createEntity("player");
  playerEntity.state.runtime = true;
  const spawn = authored ? [...authored.get("Transform").pos] : [0, 1, 4];
  playerEntity.add("Transform", { pos: spawn, euler: [0, Math.PI, 0], scale: 1 });
  playerEntity.add("MeshRef", authored
    ? {
        glbUrl: authored.get("MeshRef").glbUrl,
        isCharacter: true,
        animLib: authored.get("MeshRef").animLib,
      }
    : { kind: "capsule", color: 0x5aa9ff });
  playerEntity.add("PlayerController", {
    physics: authored?.get("Character")?.physics ?? {
      moveSpeed: 3.4, runSpeed: 6, jumpForce: 7, gravity: -18, turnSpeed: 12,
    },
  });
  playerEntity.add("Health", { hp: 100, maxHp: 100, invulnerable: 0 });
  if (authored) authored.get("MeshRef").visible = false;
  physics.addBody(playerEntity, [spawn[0], spawn[1] + 0.9, spawn[2]], {
    type: "kinematicPosition",
    collider: "capsule",
    size: [0.6, 1.7, 0.6],
  });
  world.vars.checkpoint = [...spawn];
  world.vars.coins = 0;

  const meta = editor.meta();
  const coinTotal = editor
    .editorEntities()
    .filter((e) => (e.get("Behavior") ?? []).some((b) => b.type === "Collectible")).length;
  hud.setCoins(0, coinTotal);

  playSystems = [
    world.addSystem(
      new PlayerControlSystem({ input, physics, followCam, hud, audio }),
    ),
    world.addSystem(new BehaviorSystem({ run, player: () => playerEntity, physics, audio })),
    world.addSystem(
      new GameRulesSystem({ hud, audio, settings: { winCondition: meta.winCondition, coinTotal } }),
    ),
  ];

  playing = true;
  followCam.setEnabled(true);
  hud.reset();
  $("hud").style.display = "block";
  $("hud").classList.add("playing");
  $("mode-chip").textContent = "PLAY";
  $("play").textContent = "■ Stop";
  $("play").classList.replace("play", "stop");
  world.vars.time = 0;
  world.vars.won = false;
}

function stopPlay() {
  playing = false;
  followCam.setEnabled(false);
  physics.clear();
  // restore the authored scene exactly as it was
  for (const e of [...world.entities.values()]) world.destroy(e);
  editor.loadJson(snapshot);
  playerEntity = null;
  for (const s of playSystems) {
    s.dispose();
    world.systems.splice(world.systems.indexOf(s), 1);
  }
  playSystems = [];
  hud.reset();
  $("hud").style.display = "none";
  $("hud").classList.remove("playing");
  $("mode-chip").textContent = "EDIT";
  $("play").textContent = "▶ Play";
  $("play").classList.replace("stop", "play");
  editor.setPlaying(false);
}

$("play").onclick = () => (playing ? stopPlay() : startPlay());
addEventListener("keydown", (e) => {
  if (e.code === "Escape" && playing) stopPlay();
});

// ── ⌨ Controls — rebindable action map (Phase 2, spec §7) ─────────────────
const ACTION_LABELS = {
  forward: "ရှေ့",
  back: "နောက်",
  left: "ဘယ်",
  right: "ညာ",
  jump: "ခုန်",
  run: "ပြေး",
  interact: "စကားပြော",
};
function renderControls() {
  const list = $("controls-list");
  if (!list) return;
  list.innerHTML = "";
  const km = input.keymap();
  for (const [action, label] of Object.entries(ACTION_LABELS)) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:5px";
    const name = document.createElement("span");
    name.style.cssText = "flex:1;font-size:12px";
    name.textContent = label;
    const btn = document.createElement("button");
    btn.textContent = km[action];
    btn.style.minWidth = "84px";
    btn.onclick = () => {
      btn.textContent = "…ကီးနှိပ်ပါ";
      const capture = (e) => {
        e.preventDefault();
        removeEventListener("keydown", capture, true);
        input.setKeymap({ [action]: e.code });
        renderControls();
      };
      addEventListener("keydown", capture, true);
    };
    row.append(name, btn);
    list.append(row);
  }
}
$("controls").onclick = () => {
  $("controls-panel").classList.toggle("hidden");
  renderControls();
};

// ── 🌐 Online — Phase 3 multiplayer (spec §9) ──────────────────────────────
// Joining while editing auto-starts play; the net system lives outside the
// play-system list so a Stop/Play round-trip keeps the connection.
const net = new NetSystem({ world, hud });
world.addSystem(net);
net.playerOf = () => playerEntity;

$("online").onclick = () => {
  if (net.connected) {
    net.disconnect();
    $("online").textContent = "🌐 Online";
    return;
  }
  if (!playing) startPlay();
  const url =
    new URLSearchParams(location.search).get("server") ??
    (location.hostname === "localhost"
      ? "ws://localhost:8789"
      : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/engine-ws`);
  const name = prompt("နာမည်:", "Player") ?? "Player";
  net.connect(url, name, "world");
  $("online").textContent = "🌐 ချိတ်ထား";
  $("chat").style.display = "block";
};
$("chat").addEventListener("keydown", (e) => {
  e.stopPropagation(); // typing must not move the character
  if (e.code === "Enter") {
    net.sendChat(e.target.value.trim());
    e.target.value = "";
    e.target.blur();
  }
});

// starter content so the first visit isn't an empty void
$("scene-name").value = "My Game";
(function starter() {
  const plat = editor.editorEntities();
  if (plat.length) return;
  document.querySelector('[data-add="platform"]').click();
  const p = editor.selected.get("Transform");
  p.pos = [0, 0.2, -4];
  for (const [x, z] of [[-2, 0], [2, 0], [0, 3]]) {
    document.querySelector('[data-add="coin"]').click();
    const t = editor.selected.get("Transform");
    t.pos = [x, 1, z];
  }
})();

// ── loop (spec §2: fixed update + interpolated render) ─────────────────────
startLoop({
  poll: () => input.poll(),
  fixed: (dt) => {
    if (playing) {
      world.fixedUpdate(dt);
      physics.step(dt);
    }
  },
  update: (dt) => {
    world.update(dt);
    if (playing && playerEntity) {
      followCam.follow(playerEntity.get("Transform").pos, dt);
      // spatial audio listener rides the camera (Phase 2)
      audio.updateListener(
        [camera.position.x, camera.position.y, camera.position.z],
        followCam.yaw,
      );
      hud.tick();
    } else {
      editor.orbit.update();
    }
  },
  render: () => {
    resize(camera);
    renderer.render(scene, camera);
  },
});

// keep the linter honest about the export surface (spec §19 Engine api sketch
// arrives with the Colyseus phase; for now the page IS the engine instance)
export { world, FIXED_DT };
