/// FPV maps ၆ ခု — three.js primitives နဲ့ ဆောက်ထားတယ် (asset download မလို၊
/// load မြန်၊ ဖုန်းမှာလည်း ပေါ့)။
///
/// Map တစ်ခုစီက ပြန်ပေးတာ — scene ထဲထည့်မယ့် group၊ AABB colliders၊
/// race gates (အစီအစဉ်လိုက်)၊ strike targets၊ spawn point၊ sky/fog config။
///
/// ★ Strike range မှာ ပစ်မှတ်တွေက **လူသုံးမပြုတော့တဲ့ စစ်ယာဉ်အိုဟောင်းတွေနဲ့
///   မီးပုံးပစ်မှတ်တွေသာ** — လူပုံစံ ပစ်မှတ် လုံးဝ မထည့်ဘူး။ Gwave မှာ
///   လူငယ်တွေပါ သုံးနေလို့ လူကို ပစ်မှတ်ထားတဲ့ simulation မလုပ်ဘူး။

import * as THREE from "three";

import type { Collider } from "./physics";

export type Gate = { pos: THREE.Vector3; radius: number };
export type Target = {
  id: number;
  pos: THREE.Vector3;
  radius: number;
  mesh: THREE.Object3D;
  alive: boolean;
  /// ပြန်ပေါ်ချိန် (score attack ဆက်ကစားလို့ရအောင်)
  respawnAt: number;
};

export type FpvMap = {
  id: string;
  group: THREE.Group;
  colliders: Collider[];
  gates: Gate[];
  targets: Target[];
  spawn: THREE.Vector3;
  spawnYaw: number;
  sky: number;
  fog: number;
  fogFar: number;
  ground: number;
};

export const FPV_MAPS: { id: string; nameMy: string; blurbMy: string; emoji: string }[] = [
  { id: "race", nameMy: "မိုးကုတ် ပြိုင်ကွင်း", emoji: "🏁", blurbMy: "Gate ၁၀ ခု ပတ်လမ်း — lap timer နဲ့ အချိန်တိုင်း ပြိုင်မောင်း။" },
  { id: "park", nameMy: "Freestyle ပန်းခြံ", emoji: "🛹", blurbMy: "မျှော်စင်၊ ခုံးတံတား၊ ကွက်လပ်တွေ — trick လေ့ကျင့်ကွင်း။" },
  { id: "city", nameMy: "မြို့ပြ အမိုးများ", emoji: "🏙", blurbMy: "အဆောက်အအုံကြားက ချောက်ကြား dive နဲ့ rooftop gap တွေ။" },
  { id: "canyon", nameMy: "တောင်ကြား ချိုင့်ဝှမ်း", emoji: "🏔", blurbMy: "Long-range စတိုင် — တောင်ကြားထဲ အမြန် proximity မောင်း။" },
  { id: "warehouse", nameMy: "ဂိုဒေါင်တွင်း", emoji: "🏭", blurbMy: "Whoop အတွက် — တိုင်ကြား၊ ပေါက်ကြား tight track။" },
  { id: "range", nameMy: "Strike Range", emoji: "💥", blurbMy: "စွန့်ပစ် စစ်ယာဉ်အိုတွေကို kamikaze ထိုးပစ်တဲ့ လေ့ကျင့်ကွင်း (score attack)။" },
];

/// ── helpers ────────────────────────────────────────────────────────────
type Ctx = { g: THREE.Group; colliders: Collider[] };

function box(
  c: Ctx,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: number,
  opts?: { collide?: boolean; rotY?: number; emissive?: number },
) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.08,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissive ? 0.7 : 0,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (opts?.rotY) m.rotation.y = opts.rotY;
  c.g.add(m);
  if (opts?.collide !== false && !opts?.rotY) {
    c.colliders.push({
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    });
  }
  return m;
}

function ground(c: Ctx, size: number, color: number) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(size, 40),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  m.rotation.x = -Math.PI / 2;
  c.g.add(m);
}

function gateRing(c: Ctx, x: number, y: number, z: number, color: number, radius = 2.2): Gate {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.14, 10, 28),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.4 }),
  );
  m.position.set(x, y, z);
  c.g.add(m);
  return { pos: new THREE.Vector3(x, y, z), radius };
}

function tree(c: Ctx, x: number, z: number, s = 1) {
  box(c, 0.5 * s, 2.4 * s, 0.5 * s, x, 1.2 * s, z, 0x6b4a2b);
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.6 * s, 3 * s, 7),
    new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 1 }),
  );
  crown.position.set(x, 3.4 * s, z);
  c.g.add(crown);
}

/// စွန့်ပစ် စစ်ယာဉ်အိုပုံ (သံချေးရောင် box စုစည်းမှု) — strike range ပစ်မှတ်
function derelictVehicle(c: Ctx, x: number, z: number, rotY: number, kind: "tank" | "truck") {
  const grp = new THREE.Group();
  const rust = new THREE.MeshStandardMaterial({ color: 0x6e5b45, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4c463c, roughness: 1 });
  if (kind === "tank") {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.2), rust);
    hull.position.y = 0.75;
    const turret = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 1.5), dark);
    turret.position.set(-0.2, 1.6, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8), dark);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(1.6, 1.62, 0);
    grp.add(hull, turret, barrel);
  } else {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1, 1.9), rust);
    bed.position.y = 0.9;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 1.9), dark);
    cab.position.set(1.7, 1.15, 0);
    grp.add(bed, cab);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = rotY;
  c.g.add(grp);
  return grp;
}

/// ── map builders ───────────────────────────────────────────────────────
function buildRace(c: Ctx): Partial<FpvMap> {
  ground(c, 220, 0x2e6b3e);
  const gates: Gate[] = [];
  // Start arch
  box(c, 0.4, 5, 0.4, -3, 2.5, 0, 0xffffff);
  box(c, 0.4, 5, 0.4, 3, 2.5, 0, 0xffffff);
  box(c, 6.4, 0.4, 0.4, 0, 5, 0, 0xf06a6a, { collide: false });
  // ပတ်လမ်း gate ၁၀ ခု — အမြင့်အနိမ့် ရောထား
  const pts: [number, number, number][] = [
    [0, 3, -25], [18, 5, -48], [45, 3, -55], [65, 8, -35], [70, 4, -5],
    [55, 10, 25], [28, 3, 40], [0, 6, 48], [-25, 4, 30], [-20, 3, 5],
  ];
  pts.forEach(([x, y, z], i) => gates.push(gateRing(c, x, y, z, i % 2 ? 0x44e0c0 : 0xf5c542)));
  // Pylon တွေ + သစ်ပင်
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    tree(c, Math.cos(a) * 90, Math.sin(a) * 90, 1 + (i % 3) * 0.4);
  }
  box(c, 2, 12, 2, 40, 6, -20, 0xc9d4e0);
  box(c, 2, 9, 2, -35, 4.5, -30, 0xc9d4e0);
  return { gates, spawn: new THREE.Vector3(0, 1.2, 8), spawnYaw: Math.PI, sky: 0x87bfe8, fog: 0x87bfe8, fogFar: 260, ground: 0x2e6b3e };
}

function buildPark(c: Ctx): Partial<FpvMap> {
  ground(c, 160, 0x3a7d44);
  // မျှော်စင် ၃ ခု (ပေါက်ကြားနဲ့)
  for (const [x, z, h] of [[-20, -20, 16], [22, -8, 22], [0, 25, 12]] as const) {
    box(c, 6, h, 6, x, h / 2, z, 0x8b93a3);
    box(c, 8, 0.6, 8, x, h + 0.3, z, 0xa7afc0);
  }
  // ခုံးတံတား (ကွက်လပ် underneath)
  box(c, 1.2, 8, 1.2, -8, 4, 10, 0x9b7d5a);
  box(c, 1.2, 8, 1.2, 8, 4, 10, 0x9b7d5a);
  box(c, 18, 0.7, 3, 0, 8.4, 10, 0xb08c62);
  // Rail/ledge တွေ
  box(c, 24, 1, 1, 0, 0.5, -12, 0x777f8f);
  box(c, 1, 1, 20, -30, 0.5, 0, 0x777f8f);
  for (let i = 0; i < 10; i++) tree(c, -60 + i * 13, -45 + (i % 2) * 90, 1.1);
  return { spawn: new THREE.Vector3(0, 1.2, 40), spawnYaw: Math.PI, sky: 0xa8d3f0, fog: 0xa8d3f0, fogFar: 220, ground: 0x3a7d44 };
}

function buildCity(c: Ctx): Partial<FpvMap> {
  ground(c, 200, 0x2a2f3a);
  // အဆောက်အအုံ grid — ချောက်ကြား dive လမ်းကြောင်းတွေ ဖြစ်အောင် ကွာဟထား
  const rng = (seed: number) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const r = rng(42);
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      if (Math.abs(gx) + Math.abs(gz) < 1) continue;
      const h = 10 + Math.floor(r() * 26);
      const x = gx * 22 + (r() - 0.5) * 6;
      const z = gz * 22 + (r() - 0.5) * 6;
      box(c, 12, h, 12, x, h / 2, z, 0x3d4656 + Math.floor(r() * 3) * 0x050505);
      // Rooftop décor + neon
      box(c, 3, 1.5, 3, x + 3, h + 0.75, z - 2, 0x59637a);
      if (r() > 0.6) box(c, 8, 0.5, 0.5, x, h + 2, z + 5, 0x000000, { collide: false, emissive: [0xf06a9a, 0x44e0c0, 0xf5c542][Math.floor(r() * 3)]! });
    }
  }
  return { spawn: new THREE.Vector3(0, 30, 0), spawnYaw: 0, sky: 0x1b2333, fog: 0x1b2333, fogFar: 240, ground: 0x2a2f3a };
}

function buildCanyon(c: Ctx): Partial<FpvMap> {
  ground(c, 260, 0x8a6f4d);
  // ချောက်နံရံ (cone တောင်တန်း ၂ တန်း) — အလယ်က ချိုင့်ဝှမ်းလမ်း
  for (let i = 0; i < 12; i++) {
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(14 + (i % 3) * 4, 34 + (i % 4) * 10, 7),
        new THREE.MeshStandardMaterial({ color: side > 0 ? 0x9c7a50 : 0x8d6c46, roughness: 1, flatShading: true }),
      );
      const z = -120 + i * 22;
      const x = side * (20 + Math.sin(i * 1.3) * 8);
      m.position.set(x, 15, z);
      c.g.add(m);
      c.colliders.push({
        min: new THREE.Vector3(x - 8, 0, z - 8),
        max: new THREE.Vector3(x + 8, 30, z + 8),
      });
    }
  }
  const gates: Gate[] = [];
  for (let i = 0; i < 6; i++) {
    gates.push(gateRing(c, Math.sin(i * 1.6) * 10, 6 + (i % 3) * 6, -100 + i * 40, 0xf5c542, 3));
  }
  return { gates, spawn: new THREE.Vector3(0, 1.2, 120), spawnYaw: Math.PI, sky: 0xe8c99a, fog: 0xdcb98c, fogFar: 300, ground: 0x8a6f4d };
}

function buildWarehouse(c: Ctx): Partial<FpvMap> {
  ground(c, 90, 0x50555e);
  // နံရံ ၄ ဖက် + မျက်နှာကျက်
  const W = 60;
  const H = 10;
  box(c, W, H, 1, 0, H / 2, -W / 2, 0x6a707c);
  box(c, W, H, 1, 0, H / 2, W / 2, 0x6a707c);
  box(c, 1, H, W, -W / 2, H / 2, 0, 0x6a707c);
  box(c, 1, H, W, W / 2, H / 2, 0, 0x6a707c);
  box(c, W, 1, W, 0, H + 0.5, 0, 0x596070);
  // တိုင်တန်းတွေ + ကွက်လပ် ရှိတဲ့ အလယ်စင်
  for (let i = -2; i <= 2; i++) {
    box(c, 1.2, H, 1.2, i * 10, H / 2, -10, 0x7c8494);
    box(c, 1.2, H, 1.2, i * 10, H / 2, 10, 0x7c8494);
  }
  box(c, 20, 0.6, 8, 0, 4, 0, 0x8a92a4);
  box(c, 6, 4, 0.5, 0, 2, 20, 0x444a56); // ပေါက်ဝ (ဘေးက ပတ်ဝင်ရ)
  const gates: Gate[] = [
    gateRing(c, -15, 2.2, -20, 0x44e0c0, 1.6),
    gateRing(c, 15, 2.2, -20, 0xf5c542, 1.6),
    gateRing(c, 15, 6, 20, 0x44e0c0, 1.6),
    gateRing(c, -15, 2.2, 20, 0xf5c542, 1.6),
  ];
  return { gates, spawn: new THREE.Vector3(0, 1, 26), spawnYaw: Math.PI, sky: 0x30343c, fog: 0x30343c, fogFar: 120, ground: 0x50555e };
}

function buildRange(c: Ctx): Partial<FpvMap> {
  ground(c, 240, 0x5c6b4a);
  const targets: Target[] = [];
  let tid = 0;
  // စွန့်ပစ် စစ်ယာဉ်အိုတွေ (ပစ်မှတ်) — ကွင်းထဲ ပြန့်ကြဲထား
  const spots: [number, number, number, "tank" | "truck"][] = [
    [-40, -30, 0.4, "tank"], [30, -50, 2.1, "truck"], [60, 10, 1.2, "tank"],
    [-55, 25, 2.8, "truck"], [10, 55, 0.9, "tank"], [-15, -70, 1.7, "truck"],
    [45, -15, 0.2, "truck"], [-70, -10, 1.1, "tank"],
  ];
  for (const [x, z, ry, kind] of spots) {
    const mesh = derelictVehicle(c, x, z, ry, kind);
    targets.push({ id: tid++, pos: new THREE.Vector3(x, 1, z), radius: 2.6, mesh, alive: true, respawnAt: 0 });
  }
  // မီးပုံး ပစ်မှတ် (လေထဲ)
  for (const [x, y, z] of [[-20, 12, -20], [25, 18, 20], [0, 25, -45], [-45, 15, 40]] as const) {
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf06a6a, emissive: 0xf06a6a, emissiveIntensity: 0.35 }),
    );
    b.position.set(x, y, z);
    c.g.add(b);
    targets.push({ id: tid++, pos: new THREE.Vector3(x, y, z), radius: 2.2, mesh: b, alive: true, respawnAt: 0 });
  }
  // ကင်းမျှော်စင် + အကာအရံတွေ (ပစ်မှတ် မဟုတ်)
  box(c, 3, 14, 3, 80, 7, -60, 0x6e6a58);
  box(c, 3, 14, 3, -80, 7, 60, 0x6e6a58);
  for (let i = 0; i < 8; i++) box(c, 6, 2.5, 1.2, -60 + i * 18, 1.25, -85, 0x74705e);
  return { targets, spawn: new THREE.Vector3(0, 1.2, 90), spawnYaw: Math.PI, sky: 0xb9c6a8, fog: 0xaab89b, fogFar: 280, ground: 0x5c6b4a };
}

export function buildFpvMap(id: string): FpvMap {
  const c: Ctx = { g: new THREE.Group(), colliders: [] };
  const builders: Record<string, (c: Ctx) => Partial<FpvMap>> = {
    race: buildRace,
    park: buildPark,
    city: buildCity,
    canyon: buildCanyon,
    warehouse: buildWarehouse,
    range: buildRange,
  };
  const part = (builders[id] ?? buildRace)(c);
  return {
    id,
    group: c.g,
    colliders: c.colliders,
    gates: part.gates ?? [],
    targets: part.targets ?? [],
    spawn: part.spawn ?? new THREE.Vector3(0, 1.2, 0),
    spawnYaw: part.spawnYaw ?? 0,
    sky: part.sky ?? 0x87bfe8,
    fog: part.fog ?? 0x87bfe8,
    fogFar: part.fogFar ?? 240,
    ground: part.ground ?? 0x2e6b3e,
  };
}
