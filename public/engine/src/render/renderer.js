// render/renderer.js — three.js view of the ECS (spec §1)
// The RenderSystem mirrors Transform/MeshRef data into three objects each
// frame — the scene graph is a VIEW of the ECS, never the source of truth.
// GLB meshes load async through GLTFLoader and drop into the same map.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { System } from "../core/ecs.js";
import { Animator, loadAnimationLibrary } from "../character/animator.js";

export const ENV_PRESETS = {
  night: { bg: 0x0e1420, fog: [40, 120], sun: 2.0 },
  day: { bg: 0x9ec8ff, fog: [60, 180], sun: 3.0 },
  sunset: { bg: 0x2a1830, fog: [40, 130], sun: 2.4 },
};

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(10, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 100 });
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x333844, 0.7));

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshStandardMaterial({ color: 0x16203a, roughness: 0.96 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(120, 120, 0x2a3a5c, 0x1a2740);
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  scene.add(grid);

  function applyEnv(name) {
    const e = ENV_PRESETS[name] ?? ENV_PRESETS.night;
    scene.background = new THREE.Color(e.bg);
    scene.fog = new THREE.Fog(e.bg, e.fog[0], e.fog[1]);
    sun.intensity = e.sun;
  }
  applyEnv("night");

  function resize(camera) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  return { renderer, scene, applyEnv, resize };
}

const MAT = (c) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.08 });

/// Primitive factory — MeshRef.kind → geometry (editor palette shapes).
export function buildPrimitive(m) {
  const kind = m.kind ?? "box";
  let geo;
  let y = 0;
  if (kind === "sphere") geo = new THREE.SphereGeometry(0.6, 28, 20);
  else if (kind === "cylinder") geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 24);
  else if (kind === "platform") geo = new THREE.BoxGeometry(4, 0.4, 4);
  else if (kind === "ramp") geo = new THREE.BoxGeometry(4, 0.3, 3);
  else if (kind === "coin") geo = new THREE.TorusGeometry(0.4, 0.14, 14, 28);
  else if (kind === "capsule") geo = new THREE.CapsuleGeometry(0.3, 1.1, 6, 12);
  else geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.Mesh(geo, MAT(m.color ?? 0x8899aa));
  mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, y };
}

const gltfLoader = new GLTFLoader();

export class RenderSystem extends System {
  query = ["Transform", "MeshRef"];

  constructor(scene) {
    super();
    this.scene = scene;
    this.objects = new Map(); // entityId -> Object3D
    this.mixers = new Map(); // entityId -> AnimationMixer
  }

  init() {
    this.world.events.on("entityDestroyed", ({ entity }) => {
      const o = this.objects.get(entity.id);
      if (o) {
        this.scene.remove(o);
        this.objects.delete(entity.id);
        this.mixers.delete(entity.id);
      }
    });
  }

  objectFor(entity) {
    let obj = this.objects.get(entity.id);
    if (obj) return obj;
    const m = entity.get("MeshRef");
    if (m.glbUrl) {
      // async GLB — placeholder group swaps in when loaded
      obj = new THREE.Group();
      gltfLoader.load(
        m.glbUrl,
        (g) => {
          const node = g.scene;
          node.traverse((o) => {
            if (o.isMesh) o.castShadow = o.receiveShadow = true;
          });
          // normalize to ~1.7 units tall, feet on the origin
          const box = new THREE.Box3().setFromObject(node);
          const sz = box.getSize(new THREE.Vector3());
          const s = (m.fitHeight ?? 1.7) / (sz.y || 1);
          node.scale.setScalar(s);
          const b2 = new THREE.Box3().setFromObject(node);
          node.position.y -= b2.min.y;
          obj.add(node);
          if (g.animations?.length || m.animLib) {
            const mixer = new THREE.AnimationMixer(node);
            this.mixers.set(entity.id, mixer);
            entity.state.clips = g.animations ?? [];
            entity.state.mixer = mixer;
            // Phase 2 — animator state machine; shared animation-library GLB
            // clips retarget by bone name onto same-skeleton characters
            const animator = new Animator(mixer, entity.state.clips);
            entity.state.animator = animator;
            if (m.animLib) {
              loadAnimationLibrary(m.animLib).then((clips) => {
                if (clips.length) animator.addClips(clips);
              });
            }
            this.world.events.emit("glbReady", { entity, animations: entity.state.clips });
          }
        },
        undefined,
        (err) => console.warn("[render] GLB failed", m.glbUrl, err),
      );
    } else {
      obj = buildPrimitive(m).mesh;
    }
    obj.userData.entityId = entity.id;
    this.scene.add(obj);
    this.objects.set(entity.id, obj);
    return obj;
  }

  update(dt) {
    for (const e of this.entities) {
      const t = e.get("Transform");
      const m = e.get("MeshRef");
      const obj = this.objectFor(e);
      obj.visible = m.visible !== false;
      obj.position.set(t.pos[0], t.pos[1], t.pos[2]);
      if (t.euler) obj.rotation.set(t.euler[0], t.euler[1], t.euler[2]);
      if (t.scale != null) obj.scale.setScalar(t.scale);
    }
    for (const mixer of this.mixers.values()) mixer.update(dt);
  }

  dispose() {
    for (const o of this.objects.values()) this.scene.remove(o);
    this.objects.clear();
    this.mixers.clear();
  }
}
