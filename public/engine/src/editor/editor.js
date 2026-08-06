// editor/editor.js — World Maker editing layer (spec §12)
// Same engine, edit mode: palette → entities, raycast select, gizmo writes
// BACK into Transform components (ECS stays the source of truth), hierarchy,
// properties + behavior panel, save/load .gwave.json.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { BEHAVIOR_DEFS } from "../script/behaviors.js";
import { saveScene, loadScene } from "../serialize/scene.js";

const PALETTE = {
  box: { kind: "box", y: 0.5 },
  sphere: { kind: "sphere", y: 0.6 },
  cylinder: { kind: "cylinder", y: 0.6 },
  platform: { kind: "platform", y: 0.2 },
  ramp: { kind: "ramp", y: 0.5 },
  coin: { kind: "coin", y: 1, coin: true },
};

export function createEditor({ world, renderSystem, camera, canvas, applyEnv }) {
  const $ = (id) => document.getElementById(id);
  let selected = null;
  let uid = 1;
  let playing = false;

  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.target.set(0, 1, 0);
  orbit.maxPolarAngle = Math.PI / 2.05;

  const gizmo = new TransformControls(camera, canvas);
  gizmo.addEventListener("dragging-changed", (e) => (orbit.enabled = !e.value));
  // gizmo moves the three object — write the result back into the component
  gizmo.addEventListener("objectChange", () => {
    if (!selected) return;
    const obj = renderSystem.objectFor(selected);
    const t = selected.get("Transform");
    t.pos = [obj.position.x, obj.position.y, obj.position.z];
    t.euler = [obj.rotation.x, obj.rotation.y, obj.rotation.z];
    t.scale = obj.scale.x;
    refreshProps();
  });
  renderSystem.scene.add(gizmo);

  // ── entity factory ───────────────────────────────────────────────────────
  function addPrimitive(type) {
    const p = PALETTE[type];
    if (!p) return null;
    const e = world.createEntity(`${p.coin ? "Coin" : "Object"} ${uid++}`);
    e.add("Transform", { pos: [0, p.y, 0], euler: [0, 0, 0], scale: 1 });
    e.add("MeshRef", {
      kind: p.kind,
      color: p.coin ? 0xffd85e : new THREE.Color().setHSL(Math.random(), 0.5, 0.55).getHex(),
    });
    e.add("Behavior", p.coin ? [{ type: "Collectible", value: 10 }] : []);
    select(e);
    return e;
  }

  function addGlb(url, asCharacter) {
    if (!url) {
      alert("Paste a GLB URL");
      return null;
    }
    const e = world.createEntity(`${asCharacter ? "Character" : "Mesh"} ${uid++}`);
    e.add("Transform", { pos: [0, 0, 0], euler: [0, 0, 0], scale: 1 });
    e.add("MeshRef", { glbUrl: url, isCharacter: asCharacter || undefined });
    e.add("Behavior", []);
    if (asCharacter) {
      e.add("Character", {
        isPlayerStart: false,
        physics: { moveSpeed: 3.4, runSpeed: 6, jumpForce: 7, gravity: -18, turnSpeed: 12 },
      });
    }
    select(e);
    return e;
  }

  function removeEntity(e) {
    if (selected === e) {
      gizmo.detach();
      selected = null;
    }
    world.destroy(e);
    rebuildHierarchy();
    refreshProps();
  }

  function select(e) {
    selected = e;
    if (e && !playing) gizmo.attach(renderSystem.objectFor(e));
    else gizmo.detach();
    rebuildHierarchy();
    refreshProps();
  }

  function editorEntities() {
    return [...world.entities.values()].filter((e) => !e.state.runtime && e.has("MeshRef"));
  }

  // ── hierarchy ────────────────────────────────────────────────────────────
  function rebuildHierarchy() {
    const h = $("hierarchy");
    if (!h) return;
    h.innerHTML = "";
    for (const e of editorEntities()) {
      const el = document.createElement("div");
      el.className = `item${e === selected ? " sel" : ""}`;
      const behaviors = e.get("Behavior") ?? [];
      const ic = e.get("MeshRef").isCharacter
        ? "🧍"
        : behaviors.some((b) => b.type === "Collectible")
          ? "⭐"
          : "▢";
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = `${ic} ${e.name}`;
      t.onclick = () => select(e);
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = "✕";
      x.onclick = (ev) => {
        ev.stopPropagation();
        removeEntity(e);
      };
      el.append(t, x);
      h.appendChild(el);
    }
    const count = $("count");
    if (count) count.textContent = String(editorEntities().length);
  }

  // ── properties panel ─────────────────────────────────────────────────────
  function refreshProps() {
    const p = $("props");
    if (!p) return;
    if (!selected) {
      p.innerHTML = '<p style="color:var(--muted)">Select an object</p>';
      return;
    }
    const e = selected;
    const t = e.get("Transform");
    const f = (v) => (+v).toFixed(2);
    p.innerHTML = "";

    const field = (labelText, value, oninput, type = "text") => {
      const label = document.createElement("label");
      label.className = "mini";
      label.textContent = labelText;
      const input = document.createElement("input");
      input.type = type;
      input.value = value;
      input.style.marginBottom = "6px";
      input.oninput = () => oninput(input.value);
      p.append(label, input);
      return input;
    };

    field("Name", e.name, (v) => {
      e.name = v;
      rebuildHierarchy();
    });
    field("Pos X", f(t.pos[0]), (v) => (t.pos[0] = +v || 0), "number");
    field("Pos Y", f(t.pos[1]), (v) => (t.pos[1] = +v || 0), "number");
    field("Pos Z", f(t.pos[2]), (v) => (t.pos[2] = +v || 0), "number");
    field("Rotation Y°", f(((t.euler?.[1] ?? 0) * 180) / Math.PI), (v) => {
      t.euler = t.euler ?? [0, 0, 0];
      t.euler[1] = ((+v || 0) * Math.PI) / 180;
    }, "number");
    field("Scale", f(t.scale ?? 1), (v) => (t.scale = Math.max(0.01, +v || 1)), "number");

    // physics body type
    const rbLabel = document.createElement("label");
    rbLabel.className = "mini";
    rbLabel.textContent = "Physics body";
    const rbSel = document.createElement("select");
    for (const [v, txt] of [
      ["static", "static (solid)"],
      ["dynamic", "dynamic (falls)"],
      ["none", "none (decor)"],
    ]) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = txt;
      rbSel.append(o);
    }
    rbSel.value = e.get("RigidBody")?.type ?? "static";
    rbSel.onchange = () => {
      if (rbSel.value === "none") e.remove("RigidBody");
      else e.add("RigidBody", { type: rbSel.value });
    };
    p.append(rbLabel, rbSel);

    // player start (characters only)
    const ch = e.get("Character");
    if (ch) {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:10px;color:var(--warn)";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.style.width = "auto";
      cb.checked = !!ch.isPlayerStart;
      cb.onchange = () => {
        for (const other of editorEntities()) {
          const oc = other.get("Character");
          if (oc) oc.isPlayerStart = false;
        }
        ch.isPlayerStart = cb.checked;
      };
      wrap.append(cb, document.createTextNode(" ★ Player start"));
      p.append(wrap);
    }

    // behaviors
    const h3 = document.createElement("h3");
    h3.textContent = "Behaviors";
    p.append(h3);
    const behaviors = e.get("Behavior");
    behaviors.forEach((b, i) => {
      const card = document.createElement("div");
      card.className = "bhv";
      const top = document.createElement("div");
      top.className = "top";
      const bold = document.createElement("b");
      bold.textContent = b.type;
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = "✕";
      x.onclick = () => {
        behaviors.splice(i, 1);
        refreshProps();
        rebuildHierarchy();
      };
      top.append(bold, x);
      card.append(top);
      for (const k of Object.keys(b)) {
        if (k === "type") continue;
        const label = document.createElement("label");
        label.className = "mini";
        label.textContent = k;
        const input = document.createElement("input");
        input.value = b[k];
        input.style.marginBottom = "5px";
        input.oninput = () => {
          b[k] = Number.isNaN(+input.value) ? input.value : +input.value;
        };
        card.append(label, input);
      }
      p.append(card);
    });
    const addSel = document.createElement("select");
    addSel.innerHTML =
      '<option value="">+ add behavior…</option>' +
      Object.keys(BEHAVIOR_DEFS)
        .map((k) => `<option>${k}</option>`)
        .join("");
    addSel.onchange = () => {
      if (!addSel.value) return;
      behaviors.push({ type: addSel.value, ...structuredClone(BEHAVIOR_DEFS[addSel.value]) });
      refreshProps();
      rebuildHierarchy();
    };
    addSel.style.marginTop = "6px";
    p.append(addSel);
  }

  // ── picking ──────────────────────────────────────────────────────────────
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  canvas.addEventListener("pointerdown", (e) => {
    if (playing || gizmo.dragging) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = editorEntities().map((en) => renderSystem.objectFor(en));
    const hits = ray.intersectObjects(objs, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.entityId) o = o.parent;
      const ent = o && world.entities.get(o.userData.entityId);
      if (ent) select(ent);
    }
  });

  // ── toolbar wiring ───────────────────────────────────────────────────────
  document.querySelectorAll("[data-add]").forEach((b) => {
    b.onclick = () => {
      const t = b.dataset.add;
      if (t === "glb") addGlb($("glb-url").value.trim(), false);
      else if (t === "character") addGlb($("glb-url").value.trim(), true);
      else addPrimitive(t);
    };
  });
  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll("[data-mode]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      gizmo.setMode(b.dataset.mode);
    };
  });
  $("del").onclick = () => selected && removeEntity(selected);
  $("dup").onclick = () => {
    if (!selected) return;
    const s = selected;
    const m = s.get("MeshRef");
    const copy = m.glbUrl
      ? addGlb(m.glbUrl, !!m.isCharacter)
      : addPrimitive(m.kind ?? "box");
    if (!copy) return;
    const st = s.get("Transform");
    const ct = copy.get("Transform");
    ct.pos = [st.pos[0] + 1, st.pos[1], st.pos[2]];
    ct.euler = [...(st.euler ?? [0, 0, 0])];
    ct.scale = st.scale;
    copy.components.set("Behavior", structuredClone(s.get("Behavior")));
    copy.name = `${s.name} copy`;
    rebuildHierarchy();
  };
  $("env").onchange = (e) => applyEnv(e.target.value);

  // ── save / load ──────────────────────────────────────────────────────────
  $("save").onclick = () => {
    const data = saveScene(world, {
      name: $("scene-name").value,
      env: $("env").value,
      winCondition: $("win-sel").value,
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(data.name || "game").replace(/\s+/g, "_")}.gwave.json`;
    a.click();
  };
  $("load").onclick = () => $("file").click();
  $("file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      loadJson(JSON.parse(await f.text()));
    } catch (err) {
      alert(`Load failed: ${err.message}`);
    }
  };
  function loadJson(data) {
    for (const e of editorEntities()) world.destroy(e);
    const scene = loadScene(world, data);
    $("scene-name").value = scene.name;
    $("env").value = scene.env.preset;
    applyEnv(scene.env.preset);
    $("win-sel").value = scene.settings.winCondition ?? "none";
    select(null);
  }

  rebuildHierarchy();
  refreshProps();

  return {
    orbit,
    gizmo,
    get selected() {
      return selected;
    },
    editorEntities,
    loadJson,
    setPlaying(v) {
      playing = v;
      orbit.enabled = !v;
      if (v) gizmo.detach();
      else if (selected) gizmo.attach(renderSystem.objectFor(selected));
      document.querySelectorAll("aside").forEach((a) => (a.style.opacity = v ? 0.4 : 1));
    },
    meta: () => ({
      name: $("scene-name").value,
      env: $("env").value,
      winCondition: $("win-sel").value,
    }),
  };
}
