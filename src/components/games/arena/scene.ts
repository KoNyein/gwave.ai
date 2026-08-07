import * as THREE from "three";

import { ARENA, type ArenaMap, type CoverKind } from "@/lib/arena/map";

import { applyGpuBudget } from "@/lib/gpu-budget";

/// Arena ရဲ့ 3D မြင်ကွင်း (Arena spec အပိုင်း ၃)。
///
/// ★ စွမ်းဆောင်ရည် ရည်မှန်းချက်က **ဖုန်းအလယ်အလတ်မှာ 30fps, draw call
///   ၉၀ အောက်** ပါ။ ကွယ်စရာ ၁၄၄ ခုကို mesh တစ်ခုချင်း ဆောက်ရင် draw call
///   ၁၄၄ — ဒါတစ်ခုတည်းနဲ့ budget ကျော်တယ်။ ဒါကြောင့် အမျိုးအစား ၃ မျိုးကို
///   `InstancedMesh` ၃ ခုနဲ့ ဆွဲတယ် — ★ draw call ၃ ခု။
///
/// ★ လှတာထက် ချောမွေ့တာ ပိုအရေးကြီးတယ် — အရိပ်၊ bloom, post-processing
///   ဘာမှ မသုံးဘူး။ Toon material + rim light နဲ့ ပုံရိပ် ရအောင် လုပ်တယ်။

export type SceneHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /// ကစားသမား တစ်ယောက်ရဲ့ ရုပ်ကို ရယူ/ဆောက်
  actor(id: string): THREE.Group;
  removeActor(id: string): void;
  /// ရှာဖွေသူကို အရောင်နဲ့ ခွဲပြ
  setRole(id: string, seeker: boolean): void;
  resize(w: number, h: number): void;
  dispose(): void;
  /// နံရံတွေနဲ့ တိုက်မိမှု — ရိုးရှင်းတဲ့ စက်ဝိုင်း-စတုဂံ push-out
  collide(to: THREE.Vector2, radius: number): THREE.Vector2;
};

/// ★ Toon ramp — ခြေရာ ၃ ဆင့်။ Texture ကို code ကနေ ဆောက်တယ် (ဖိုင် မလို)。
function toonRamp(): THREE.DataTexture {
  const data = new Uint8Array([90, 110, 130, 255, 190, 200, 210, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

const COVER_COLOR: Record<CoverKind, number> = {
  // ★ အရောင်က ဂိမ်းအချက်အလက် — ဘယ်ဟာက ကျည်တားလဲ ဆိုတာ တစ်ချက်ကြည့်ရုံနဲ့
  //   သိရမယ်။ full = မှောင်တဲ့ ကျောက်, half = အုတ်, soft = အစိမ်း (ချုံ)。
  full: 0x6b5b4b,
  half: 0x9c8466,
  soft: 0x4f7a3f,
};

export function createArenaScene(
  canvas: HTMLCanvasElement,
  map: ArenaMap = ARENA,
): SceneHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  // ★ ဖုန်းအဟောင်းမှာ devicePixelRatio ၃ ဆိုတာ pixel ၉ ဆ — touch စက်မှာ
  //   1.5၊ desktop မှာ ၂ မှာ ကန့်သတ်တယ် (shading အလုပ် ~44% ကျ)。
  applyGpuBudget(renderer, { shadows: false });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcd9ea);
  // ★ Fog က အလှအတွက်တင် မဟုတ်ဘူး — အဝေးက ကွယ်စရာတွေကို ဖျော့စေပြီး
  //   ကစားသမားရဲ့ အာရုံကို အနီးအနားမှာ ထားတယ်။
  scene.fog = new THREE.Fog(0xbcd9ea, 45, 95);

  // ── အလင်း — ★ ပုံသေ (spec A2.1) ────────────────────────────────────
  // ပွဲအလယ်မှာ ည မဖြစ်ရ။ အရိပ် မသုံးဘူး (ဖုန်းမှာ ဈေးကြီးတယ်)。
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7a55, 1.15));
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.1);
  const angle = map.timeOfDay.fixed * Math.PI;
  sun.position.set(Math.cos(angle) * 60, 70, Math.sin(angle) * 40);
  scene.add(sun);

  const ramp = toonRamp();

  // ── မြေပြင် ─────────────────────────────────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(map.worldRadius, 48),
    new THREE.MeshToonMaterial({ color: 0x7fa05e, gradientMap: ramp }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ★ ကွင်းအစွန်း — မမြင်ရတဲ့ နံရံဆိုရင် ကစားသမားက ဘာကြောင့် ရပ်သွားလဲ
  //   မသိဘူး။ မြင်ရအောင် ထားတယ်။
  const fence = new THREE.Mesh(
    new THREE.CylinderGeometry(map.worldRadius, map.worldRadius, 3, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x3b4a2e,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.35,
    }),
  );
  fence.position.y = 1.5;
  scene.add(fence);

  // ── Zone အမှတ်အသား — မြေပြင်ပေါ်က အရောင်ကွက် ─────────────────────
  for (const zone of map.zones) {
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(zone.r - 0.35, zone.r, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(zone.x, 0.02, zone.z);
    scene.add(disc);
  }

  // ── ★ ကွယ်စရာ — အမျိုးအစားအလိုက် InstancedMesh ─────────────────────
  const box = new THREE.BoxGeometry(1, 1, 1);
  const colliders: Array<{ x: number; z: number; w: number; d: number; ry: number }> = [];
  const instanced: THREE.InstancedMesh[] = [];

  for (const kind of ["full", "half", "soft"] as CoverKind[]) {
    const items = map.covers.filter((c) => c.kind === kind);
    if (items.length === 0) continue;
    const mat = new THREE.MeshToonMaterial({ color: COVER_COLOR[kind], gradientMap: ramp });
    // ★ `soft` က ချုံ — ကျည်ဖောက်တယ်၊ collider မရှိဘူး။ မြင်ရမှုကိုသာ
    //   လျော့စေတာမို့ အနည်းငယ် ဖောက်ထားတယ်။
    if (kind === "soft") {
      mat.transparent = true;
      mat.opacity = 0.82;
    }
    const mesh = new THREE.InstancedMesh(box, mat, items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    items.forEach((c, i) => {
      p.set(c.x, c.h / 2, c.z);
      q.setFromEuler(new THREE.Euler(0, c.ry ?? 0, 0));
      s.set(c.w, c.h, c.d);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      // ★ `soft` ကို collider စာရင်းထဲ မထည့်ဘူး — ချုံထဲ ဝင်ပုန်းလို့ရရမယ်။
      if (kind !== "soft") {
        colliders.push({ x: c.x, z: c.z, w: c.w, d: c.d, ry: c.ry ?? 0 });
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    instanced.push(mesh);
  }

  // ── ကစားသမားများ ────────────────────────────────────────────────────
  const actors = new Map<string, THREE.Group>();
  const bodyGeo = new THREE.CapsuleGeometry(0.34, 0.9, 4, 10);
  const headGeo = new THREE.SphereGeometry(0.24, 12, 10);

  function actor(id: string): THREE.Group {
    let g = actors.get(id);
    if (g) return g;
    g = new THREE.Group();
    const bodyMat = new THREE.MeshToonMaterial({ color: 0x3f7fd0, gradientMap: ramp });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.95;
    body.name = "body";
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 1.72;
    head.name = "head";
    // ★ မျက်နှာမူရာကို ပြတဲ့ အနီရောင် အမှတ်အသား — capsule ချည်းဆိုရင်
    //   ဘယ်ဘက် လှည့်နေလဲ လုံးဝ မသိရဘူး။
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.26, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.72, 0.3);
    g.add(body, head, nose);
    scene.add(g);
    actors.set(id, g);
    return g;
  }

  function removeActor(id: string) {
    const g = actors.get(id);
    if (!g) return;
    scene.remove(g);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose?.();
    });
    actors.delete(id);
  }

  function setRole(id: string, seeker: boolean) {
    const g = actors.get(id);
    if (!g) return;
    // ★ ရှာဖွေသူကို **အလှမ်းဝေးကနေ မြင်ရရမယ်** — ဒါက ဂိမ်းရဲ့
    //   အခြေခံ။ ဘယ်သူက လိုက်နေလဲ မသိရင် ပုန်းစရာ အကြောင်း မရှိဘူး။
    for (const name of ["body", "head"]) {
      const mesh = g.getObjectByName(name) as THREE.Mesh | undefined;
      if (mesh) (mesh.material as THREE.MeshToonMaterial).color.setHex(seeker ? 0xd8483f : 0x3f7fd0);
    }
  }

  // ── ကင်မရာ — ကျောပြင်မြင်ကွင်း ──────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
  camera.position.set(0, 4, 8);

  // ── တိုက်မိမှု ───────────────────────────────────────────────────────

  /// ★ ရိုးရှင်းတဲ့ တိုက်မိမှု — ကစားသမားက စက်ဝိုင်း၊ ကွယ်စရာက စတုဂံ။
  ///   Physics engine မသုံးဘူး: ဒီဂိမ်းမှာ ခုန်တာ၊ တွန်းတာ မရှိဘူး —
  ///   "နံရံထဲ မဝင်ရ" ပဲ လိုတယ်။ Engine တစ်ခုက ၅၀ KB နဲ့ frame budget
  ///   ကုန်စေမယ်။
  function collide(to: THREE.Vector2, radius: number): THREE.Vector2 {
    const out = to.clone();

    // ကွင်းအစွန်း
    const dist = out.length();
    const limit = map.worldRadius - radius;
    if (dist > limit) out.multiplyScalar(limit / dist);

    for (const c of colliders) {
      // ကွယ်စရာရဲ့ ကိုယ်ပိုင် ဝင်ရိုးဆီ ပြောင်း
      const cos = Math.cos(-c.ry);
      const sin = Math.sin(-c.ry);
      const dx = out.x - c.x;
      const dz = out.y - c.z;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      const hw = c.w / 2 + radius;
      const hd = c.d / 2 + radius;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue;

      // ★ အနီးဆုံး အနားကနေ တွန်းထုတ် — ထောင့်ထဲမှာ ပိတ်မိတာ ကာကွယ်ဖို့
      //   x နဲ့ z နှစ်ခုထဲက ထွက်ရ လွယ်တာကို ရွေးတယ်။
      const pushX = hw - Math.abs(lx);
      const pushZ = hd - Math.abs(lz);
      let nx = lx;
      let nz = lz;
      if (pushX < pushZ) nx = Math.sign(lx || 1) * hw;
      else nz = Math.sign(lz || 1) * hd;

      const wx = nx * cos + nz * sin;
      const wz = -nx * sin + nz * cos;
      out.set(c.x + wx, c.z + wz);
    }
    return out;
  }

  function resize(w: number, h: number) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function dispose() {
    for (const id of [...actors.keys()]) removeActor(id);
    for (const mesh of instanced) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    fence.geometry.dispose();
    (fence.material as THREE.Material).dispose();
    bodyGeo.dispose();
    headGeo.dispose();
    box.dispose();
    ramp.dispose();
    renderer.dispose();
  }

  return { scene, camera, renderer, actor, removeActor, setRole, resize, dispose, collide };
}
