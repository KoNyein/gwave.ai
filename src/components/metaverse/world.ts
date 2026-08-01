import * as THREE from "three";

/// လောကတည်ဆောက်ခြင်း — မြေပြင်, အဆောက်အအုံ, မီးအိမ်, live screen, နေ့/ည။
///
/// Phase 8 မှာ map ၄ ခုကို data file အဖြစ် ခွဲမယ် (`maps/*.ts`)၊ ဒီ file က
/// အဲဒီအခါ "map တစ်ခုကို scene ပေါ်တင်တဲ့ engine" ဖြစ်သွားမယ်။ အခုက Gwave
/// City ရဲ့ အခြေခံပုံစံကို hardcode ထားတယ် — Phase 1 ရဲ့ acceptance
/// (collision, camera-relative movement, day/night) ကို စမ်းလို့ရဖို့။

export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };

export type World = {
  colliders: Collider[];
  lamps: THREE.Mesh[];
  lampLights: THREE.PointLight[];
  screenMesh: THREE.Mesh;
  /// timeOfDay 0→1 (0 = သန်းခေါင်, 0.25 = နံနက်, 0.5 = မွန်းတည့်, 0.75 = ညနေ)
  updateSky(timeOfDay: number): void;
  dispose(): void;
};

export const WORLD_RADIUS = 90;

/// Player ရဲ့ အနားအလျား — နံရံနဲ့ ဒီအကွာအဝေး ချန်ထားမယ်။
const PLAYER_RADIUS = 0.45;

type BuildingDef = {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
};

/// Roblox ပုံစံ — အရောင်စုံ၊ အမြင့်မတူ။ တစ်ခုချင်း hand-place လုပ်ထားတယ်
/// (random မဟုတ်) — ဘာလို့ဆို ကျပန်းဆောက်ရင် လမ်းတွေ ပိတ်ကုန်တတ်တယ်။
const BUILDINGS: BuildingDef[] = [
  { x: -26, z: -22, w: 12, h: 18, d: 12, color: 0xe94f37 },
  { x: -10, z: -30, w: 10, h: 24, d: 10, color: 0x3f88c5 },
  { x: 8, z: -28, w: 14, h: 14, d: 11, color: 0xf6ae2d },
  { x: 26, z: -20, w: 11, h: 20, d: 13, color: 0x44bba4 },
  { x: 34, z: -2, w: 10, h: 12, d: 10, color: 0xa06cd5 },
  { x: 28, z: 18, w: 13, h: 16, d: 12, color: 0x3f88c5 },
  { x: 10, z: 28, w: 12, h: 10, d: 10, color: 0xe94f37 },
  { x: -8, z: 32, w: 11, h: 13, d: 12, color: 0x44bba4 },
  { x: -26, z: 22, w: 12, h: 19, d: 11, color: 0xf6ae2d },
  { x: -36, z: 2, w: 10, h: 15, d: 14, color: 0xa06cd5 },
  { x: -44, z: -30, w: 9, h: 9, d: 9, color: 0x6c757d },
  { x: 44, z: -34, w: 9, h: 11, d: 9, color: 0x6c757d },
  { x: 46, z: 34, w: 9, h: 8, d: 9, color: 0x6c757d },
  { x: -46, z: 36, w: 9, h: 10, d: 9, color: 0x6c757d },
];

const LAMP_SPOTS: [number, number][] = [
  [-14, -8],
  [14, -8],
  [-14, 10],
  [14, 10],
  [0, -18],
  [0, 20],
  [-30, 0],
  [30, 0],
];

export function buildWorld(scene: THREE.Scene): World {
  const colliders: Collider[] = [];
  const lamps: THREE.Mesh[] = [];
  const lampLights: THREE.PointLight[] = [];
  const disposables: { dispose(): void }[] = [];

  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // ── မြေပြင် ─────────────────────────────────────────────────────────────
  const groundGeo = track(new THREE.CircleGeometry(WORLD_RADIUS, 64));
  const groundMat = track(
    new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.95 }),
  );
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(WORLD_RADIUS * 2, 60, 0x4a5560, 0x424a55);
  (grid.material as THREE.Material).opacity = 0.35;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = 0.01;
  scene.add(grid);

  // ── အဆောက်အအုံ ─────────────────────────────────────────────────────────
  // ပြတင်းပေါက်တွေက ညမှာ လင်းရမယ်လို့ emissive material သီးသန့်ထားတယ် —
  // updateSky() က emissiveIntensity ကို နေဝင်ချိန်နဲ့အတူ တင်တယ်။
  const windowMats: THREE.MeshStandardMaterial[] = [];
  for (const b of BUILDINGS) {
    const geo = track(new THREE.BoxGeometry(b.w, b.h, b.d));
    const mat = track(
      new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.7 }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // ပြတင်းပေါက်အလွှာ — အဆောက်အအုံထက် အနည်းငယ်ကြီးတဲ့ plane ၂ ချပ်
    const winMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x1a1f2e,
        emissive: 0xffd28a,
        emissiveIntensity: 0,
        roughness: 0.4,
      }),
    );
    windowMats.push(winMat);
    const winGeo = track(new THREE.PlaneGeometry(b.w * 0.72, b.h * 0.6));
    for (const [dx, dz, ry] of [
      [0, b.d / 2 + 0.02, 0],
      [0, -b.d / 2 - 0.02, Math.PI],
    ] as const) {
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(b.x + dx, b.h * 0.55, b.z + dz);
      win.rotation.y = ry;
      scene.add(win);
    }

    colliders.push({
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
    });
  }

  // ── မီးအိမ် ─────────────────────────────────────────────────────────────
  const poleGeo = track(new THREE.CylinderGeometry(0.09, 0.11, 4.2, 8));
  const poleMat = track(
    new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.6 }),
  );
  const bulbGeo = track(new THREE.SphereGeometry(0.26, 12, 10));
  for (const [lx, lz] of LAMP_SPOTS) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(lx, 2.1, lz);
    pole.castShadow = true;
    scene.add(pole);

    // မီးလုံးတစ်လုံးချင်း material သီးခြား — တစ်ခုချင်း လင်း/မှိန် လုပ်လို့ရဖို့
    const bulbMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfff0c0,
        emissive: 0xffd48a,
        emissiveIntensity: 0,
      }),
    );
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(lx, 4.3, lz);
    scene.add(bulb);
    lamps.push(bulb);

    // ★ PointLight က shadow မထုတ်ဘူး — မီးအိမ် ၈ လုံး × shadow map က
    // ဖုန်းအဟောင်းမှာ frame rate ကို ထက်ဝက်ချမယ်။
    const light = new THREE.PointLight(0xffc879, 0, 18, 2);
    light.position.set(lx, 4.2, lz);
    scene.add(light);
    lampLights.push(light);
  }

  // ── မြို့လယ် live screen (Phase 5 မှာ IVS ချိတ်မယ်) ────────────────────
  const screenGeo = track(new THREE.PlaneGeometry(16, 9));
  const screenMat = track(
    new THREE.MeshBasicMaterial({ color: 0x11151f, side: THREE.DoubleSide }),
  );
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.set(0, 7.2, -14);
  scene.add(screenMesh);

  const frameGeo = track(new THREE.BoxGeometry(17, 10, 0.4));
  const frameMat = track(
    new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.6 }),
  );
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 7.2, -14.3);
  scene.add(frame);
  colliders.push({ minX: -8.5, maxX: 8.5, minZ: -14.6, maxZ: -13.9 });

  // စင်ကြီးရဲ့ တိုင် ၂ ခု
  const legGeo = track(new THREE.BoxGeometry(0.6, 2.6, 0.6));
  for (const lx of [-6, 6]) {
    const leg = new THREE.Mesh(legGeo, frameMat);
    leg.position.set(lx, 1.3, -14.3);
    leg.castShadow = true;
    scene.add(leg);
  }

  // ── ကောင်းကင်, နေ, ကြယ် ────────────────────────────────────────────────
  const hemi = new THREE.HemisphereLight(0x9fc6e8, 0x2a2f38, 0.6);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2d5, 1.1);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);
  scene.add(sun.target);

  // ကြယ် — ည ဖြစ်မှသာ opacity တက်တယ်
  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // အပေါ်ခြမ်း hemisphere ပေါ်မှာသာ ဖြန့်
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.9 + 0.05);
    const r = 300;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = track(
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const fog = new THREE.Fog(0xb8d4e8, 40, 130);
  scene.fog = fog;

  // ── နေ့/ည ──────────────────────────────────────────────────────────────
  const SKY_NIGHT = new THREE.Color(0x0a0e24);
  const SKY_DUSK = new THREE.Color(0xff8c42);
  const SKY_DAY = new THREE.Color(0x87ceeb);
  const FOG_NIGHT = new THREE.Color(0x0d1220);
  const FOG_DAY = new THREE.Color(0xb8d4e8);

  const skyColor = new THREE.Color();
  const fogColor = new THREE.Color();
  scene.background = skyColor.clone();

  function updateSky(timeOfDay: number) {
    const t = ((timeOfDay % 1) + 1) % 1;
    // နေရဲ့ ထောင့် — 0.25 မှာ အရှေ့ကထွက်, 0.75 မှာ အနောက်မှာဝင်
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);

    sun.position.set(sunX * 60, sunY * 60, 20);
    sun.target.position.set(0, 0, 0);

    // daylight 0 (ည) → 1 (နေ့)
    const day = THREE.MathUtils.clamp(sunY * 1.4 + 0.15, 0, 1);
    // နေထွက်/နေဝင် ၂ ချိန်မှာ အနီရောင် အများဆုံး
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(sunY) * 3.5, 0, 1);

    skyColor.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    skyColor.lerp(SKY_DUSK, dusk * 0.6);
    (scene.background as THREE.Color).copy(skyColor);

    fogColor.copy(FOG_NIGHT).lerp(FOG_DAY, day);
    fogColor.lerp(SKY_DUSK, dusk * 0.4);
    fog.color.copy(fogColor);
    fog.near = 30 + day * 15;
    fog.far = 80 + day * 55;

    sun.intensity = day * 1.25;
    sun.color.setHex(dusk > 0.35 ? 0xffb37a : 0xfff2d5);
    hemi.intensity = 0.18 + day * 0.5;
    ambient.intensity = 0.14 + day * 0.28;

    // ★ မီးအိမ်က နေဝင်မှ လင်းရမယ် — မဟုတ်ရင် မွန်းတည့်မှာ မီးထွန်းထားသလို
    const night = 1 - day;
    starMat.opacity = Math.max(0, night - 0.35) * 1.4;
    const lampOn = THREE.MathUtils.smoothstep(night, 0.35, 0.7);
    for (const l of lampLights) l.intensity = lampOn * 1.5;
    for (const bulb of lamps) {
      (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = lampOn;
    }
    for (const w of windowMats) w.emissiveIntensity = lampOn * 0.9;
  }

  updateSky(0.3);

  function dispose() {
    for (const d of disposables) d.dispose();
    scene.remove(ground, grid, stars, hemi, ambient, sun, sun.target, screenMesh, frame);
    (grid.material as THREE.Material).dispose();
    grid.geometry.dispose();
    scene.fog = null;
    scene.background = null;
  }

  return { colliders, lamps, lampLights, screenMesh, updateSky, dispose };
}

/// နံရံနဲ့ တိုက်မိမှုကို ဖြေရှင်း — ★ x နဲ့ z ကို **သီးခြားစီ** စစ်တယ်။
///
/// နှစ်ခုတွဲစစ်ရင် နံရံကို ထောင့်စောင်းတိုးမိတာနဲ့ လုံးဝရပ်သွားမယ် (ကပ်နေသလို)။
/// သီးခြားစစ်ရင် တိုက်တဲ့ဝင်ရိုးကိုပဲ ပိတ်ပြီး ကျန်တစ်ခုက ဆက်ရွှေ့လို့ရလို့
/// နံရံတလျှောက် ဘေးတိုက်လျှောသွားတယ် — Roblox/GTA မှာ ခံစားရတဲ့အတိုင်း။
export function resolveCollision(
  nx: number,
  nz: number,
  oldX: number,
  oldZ: number,
  colliders: Collider[],
  worldRadius = WORLD_RADIUS,
): { x: number; z: number } {
  let x = nx;
  let z = nz;

  const hits = (px: number, pz: number) => {
    for (const c of colliders) {
      if (
        px > c.minX - PLAYER_RADIUS &&
        px < c.maxX + PLAYER_RADIUS &&
        pz > c.minZ - PLAYER_RADIUS &&
        pz < c.maxZ + PLAYER_RADIUS
      ) {
        return true;
      }
    }
    return false;
  };

  // x ဘက် ရွှေ့ကြည့် — မရရင် x ကို နေရာဟောင်းမှာထား
  if (hits(x, oldZ)) x = oldX;
  // ပြီးမှ z ဘက် (x က ဖြေရှင်းပြီးသား တန်ဖိုးနဲ့)
  if (hits(x, z)) z = oldZ;

  // လောကအစွန်း — စက်ဝိုင်းအတွင်း ပြန်ဆွဲ
  const r = Math.hypot(x, z);
  const limit = worldRadius - 2;
  if (r > limit) {
    x = (x / r) * limit;
    z = (z / r) * limit;
  }

  return { x, z };
}
