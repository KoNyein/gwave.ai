import * as THREE from "three";

import type { MapDef, ModelDef } from "./maps/types";
import { createFire, type Fire } from "./world/fire";
import { buildInterior, INTERIOR_VISIBLE_WITHIN, type Interior } from "./world/interior";
import { createPropFactory } from "./world/props";
import { createWater, type Water } from "./world/water";

/// လောကတည်ဆောက်ခြင်း — **`MapDef` တစ်ခုကို ဖတ်ပြီး ဆောက်တဲ့ engine**။
///
/// ★ ဒီ file က map တစ်ခုချင်းအကြောင်း **ဘာမှ မသိဘူး**။ မြို့လယ်မှာ ဘာရှိလဲ၊
///   ဖန်အိမ်က ဘယ်မှာလဲ ဆိုတာ `maps/*.ts` ထဲမှာသာ ရှိတယ်။ Map အသစ်ထည့်ဖို့
///   ဒီ file ကို ဘယ်တော့မှ ပြန်ထိစရာမလိုဘူး (spec 8.0 ရဲ့ မဖြစ်မနေ စည်းမျဉ်း)။

export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };

export type World = {
  colliders: Collider[];
  lamps: THREE.Mesh[];
  lampLights: THREE.PointLight[];
  /// ★ `null` = ဒီ map မှာ တိုက်ရိုက်လွှင့်မှု မျက်နှာပြင် မရှိဘူး။ map
  /// တိုင်းမှာ ထည့်လိုက်ရင် နှင်းတောင်ထိပ်မှာတောင် ကြော်ငြာဆိုင်းဘုတ်ကြီး
  /// ထောင်ထားသလို ဖြစ်တယ်။
  screenMesh: THREE.Mesh | null;
  radius: number;
  /// လျှောက်လို့ရတဲ့ အကွာအဝေး (collision clamp) — မြေပုံ/မြူ အတွက်
  /// `radius` နဲ့ မတူနိုင်ဘူး
  walkRadius: number;
  /// timeOfDay 0→1 (0 = သန်းခေါင်, 0.25 = နံနက်, 0.5 = မွန်းတည့်, 0.75 = ညနေ)။
  /// နေရောင်အား 0 (ည) → 1 (နေ့) ကို ပြန်ပေးတယ်။
  updateSky(timeOfDay: number): number;
  /// ★ ၂၅ unit အတွင်း ရောက်မှ အခန်းထဲက ပရိဘောဂတွေ ပြတယ် — frame တိုင်း
  /// ခေါ်ရမယ်။ အခန်း ၁၉ ခုစလုံး အမြဲဆွဲနေရင် ဖုန်းအဟောင်းမှာ မတင်ဘူး။
  updateInteriors(px: number, pz: number): void;
  /// ရေ — ဂိမ်းစည်းမျဉ်း (ရေထဲမှာ နှေးတယ်၊ လှေက ကုန်းမတက်) အတွက်ပါ သုံးတယ်
  water: Water;
  /// ရေလှိုင်း + မီးတောက် — frame တိုင်း။ `wetness` က မိုးရွာနေရင် ၁ —
  /// မိုးထဲမှာ မီးက အားပျော့ရမယ်။
  updateEffects(dt: number, t: number, wetness: number, px: number, pz: number): void;
  /// ★ ရာသီဥတုက ambient ကို ခဏ ပြင်းစေလို့ weather layer က ဒါကို လိုတယ်
  ambient: THREE.AmbientLight;
  setShadows(enabled: boolean): void;
  dispose(): void;
};

/// အရံ — map မှာ radius မပါရင် ဒါကို သုံးတယ်
export const WORLD_RADIUS = 90;

/// Player ရဲ့ အနားအလျား — နံရံနဲ့ ဒီအကွာအဝေး ချန်ထားမယ်။
const PLAYER_RADIUS = 0.45;

export function buildWorld(scene: THREE.Scene, map: MapDef): World {
  const colliders: Collider[] = [];
  const lamps: THREE.Mesh[] = [];
  const lampLights: THREE.PointLight[] = [];
  const interiors: Interior[] = [];
  const disposables: { dispose(): void }[] = [];
  const added: THREE.Object3D[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];

  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const place = <T extends THREE.Object3D>(o: T): T => {
    scene.add(o);
    added.push(o);
    return o;
  };

  const props = createPropFactory();
  disposables.push(props);
  const R = map.worldRadius;

  // ── မြေပြင် ─────────────────────────────────────────────────────────────
  // ★ ကျွန်း map မှာ မြေပြင်စက်ဝိုင်းကြီး **မဆွဲရ** — ဆွဲလိုက်ရင် ကျွန်း
  // တွေအောက်မှာ စိမ်းလန်းတဲ့ ကွင်းပြင်ကြီး ဖြစ်နေပြီး "လေထဲမှာ ပျံနေတယ်"
  // ဆိုတဲ့ ခံစားချက် လုံးဝ ပျောက်သွားတယ် (browser မှာ တွေ့ရတဲ့ အမှား)။
  const floating = map.terrain.kind === "islands";
  // ★ တောင်ကုန်း terrain က မြေပြင်ကို အစားထိုးတယ် — ၂ ခုစလုံး ဆွဲရင်
  // မျက်နှာပြင်တစ်ခုလုံးကို ၂ ခါ ဆွဲရပြီး fragment ကုန်ကျစရိတ် ၂ ဆ
  // ဖြစ်တယ် (လယ်ကွင်း map က 0fps ဖြစ်ခဲ့တဲ့ အကြောင်းရင်း)။
  const hilly = map.terrain.kind === "hills";
  let grid: THREE.GridHelper | null = null;
  if (!floating && !hilly) {
    const groundGeo = track(new THREE.CircleGeometry(R, 64));
    // ★ မြေပြင်က မျက်နှာပြင်အများစုကို ဖုံးတယ် — PBR မလိုဘူး
    const groundMat = track(new THREE.MeshLambertMaterial({ color: map.palette.ground }));
    const ground = place(new THREE.Mesh(groundGeo, groundMat));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;

    grid = place(new THREE.GridHelper(R * 2, 60, map.palette.grid, map.palette.grid));
    (grid.material as THREE.Material).opacity = 0.3;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = 0.01;
  }

  // ── Terrain ─────────────────────────────────────────────────────────────
  // ★ တောင်တွေက **ကြည့်ဖို့သာ** — collider မထည့်ဘူး။ heightmap တစ်ခုလုံးကို
  // collider အဖြစ် ခွဲထုတ်ရင် box ထောင်ချီ ဖြစ်ပြီး နှေးမယ်၊ ပြီးတော့
  // player က မြေပြင်ပေါ်မှာသာ လျှောက်တာ ဖြစ်လို့ ဘာမှ မထိခိုက်ဘူး။
  buildTerrain(map, place, track);

  // ── အဆောက်အအုံများ ─────────────────────────────────────────────────────
  for (const b of map.buildings) {
    if (b.interior) {
      // ★ ထဲဝင်လို့ရတဲ့အခါ **အခဲ box မဆောက်ရ** — အခွံပဲ ဆောက်တယ်။
      // အခဲဆောက်ပြီး အထဲမှာ အခန်းထားရင် နံရံ ၂ ထပ် ဖြစ်ပြီး ဝင်လို့မရဘူး။
      const it = buildInterior(scene, b, colliders, props);
      if (it) interiors.push(it);
      continue;
    }

    const geo = track(new THREE.BoxGeometry(b.w, b.h, b.d));
    const mat = track(new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.75 }));
    const mesh = place(new THREE.Mesh(geo, mat));
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (b.roof && b.roof !== "flat") {
      const roof = makeRoof(b.roof, b.w, b.d, b.roofColor ?? b.color, track);
      if (roof) {
        roof.position.set(b.x, b.h, b.z);
        place(roof);
      }
    }

    if (b.emissive) {
      const winMat = track(
        new THREE.MeshStandardMaterial({
          color: 0x1a1f2e,
          emissive: b.emissive,
          emissiveIntensity: 0,
          roughness: 0.4,
        }),
      );
      windowMats.push(winMat);
      const winGeo = track(new THREE.PlaneGeometry(b.w * 0.72, b.h * 0.55));
      for (const [dz, ry] of [
        [b.d / 2 + 0.02, 0],
        [-b.d / 2 - 0.02, Math.PI],
      ] as const) {
        const win = place(new THREE.Mesh(winGeo, winMat));
        win.position.set(b.x, b.h * 0.55, b.z + dz);
        win.rotation.y = ry;
      }
    }

    colliders.push({
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
    });
  }

  // ── သစ်ပင်များ ──────────────────────────────────────────────────────────
  buildTrees(map, place, track, colliders);

  // ── GLB models (Kenney kits etc.) ────────────────────────────────────────
  // ★ Collider တွေက **ချက်ချင်း** ဝင်တယ် — model ဖိုင်တွေ download မပြီးခင်
  //   ကတည်းက နံရံက အလုပ်လုပ်နေရမယ် (မဟုတ်ရင် load မပြီးခင် အဆောက်အအုံ
  //   ထဲ လျှောက်ဝင်ပြီး ရုတ်တရက် ပိတ်မိနေမယ်)။ မြင်ကွင်းက progressive —
  //   ရောက်လာတာနဲ့ တစ်ခုချင်း ပေါ်တယ်။
  if (map.models?.length) {
    for (const m of map.models) {
      if (!m.collide) continue;
      const sc = m.scale ?? 1;
      const hw = (m.collide.w * sc) / 2;
      const hd = (m.collide.d * sc) / 2;
      // 90° အဆ လှည့်ထားရင် w/d လဲတယ် — AABB မို့ ဒီလောက်ပဲ ဖော်ပြနိုင်တယ်
      const quarter = Math.abs(Math.round((m.ry ?? 0) / (Math.PI / 2))) % 2 === 1;
      const [a2, b2] = quarter ? [hd, hw] : [hw, hd];
      colliders.push({ minX: m.x - a2, maxX: m.x + a2, minZ: m.z - b2, maxZ: m.z + b2 });
    }
    let modelsDisposed = false;
    disposables.push({ dispose: () => { modelsDisposed = true; } });
    void (async () => {
      // ★ Lazy import — GLTFLoader က model မပါတဲ့ map တွေရဲ့ bundle ထဲ မပါစေနဲ့
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const cache = new Map<string, Promise<THREE.Group>>();
      const load = (url: string) => {
        let pr = cache.get(url);
        if (!pr) {
          pr = new Promise<THREE.Group>((resolve, reject) =>
            loader.load(url, (g) => resolve(g.scene), undefined, reject),
          );
          cache.set(url, pr);
        }
        return pr;
      };
      const placeModel = async (m: ModelDef) => {
        try {
          const src = await load(m.url);
          if (modelsDisposed) return;
          const obj = src.clone(true);
          obj.scale.setScalar(m.scale ?? 1);
          obj.position.set(m.x, (m.y ?? 0) * (m.scale ?? 1), m.z);
          obj.rotation.y = m.ry ?? 0;
          obj.traverse((c) => {
            const mesh = c as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          place(obj);
        } catch {
          // ★ Model တစ်ခု ကျရင် ကျော် — file ပျက်လို့ world တစ်ခုလုံး
          //   မပျက်ရဘူး (map data ကို ကိုးကားချက် စစ်တာ CI မှာ မဟုတ်ဘူး)
        }
      };
      // Parallel load — model တစ်ရာလောက်တောင် URL unique က ~၅၀ ပဲ (cache)
      await Promise.all(map.models!.map(placeModel));
    })();
  }

  // ── ရေ ─────────────────────────────────────────────────────────────────
  const water = createWater(map.water, scene);
  disposables.push(water);

  // ── မီး ────────────────────────────────────────────────────────────────
  const fires: Fire[] = [];
  for (const f of map.fires) {
    const fire = createFire(f.x, f.z, f.scale);
    place(fire.group);
    fires.push(fire);
    disposables.push(fire);
  }

  // ── မီးအိမ်များ ─────────────────────────────────────────────────────────
  const poleGeo = track(new THREE.CylinderGeometry(0.09, 0.11, 4.2, 8));
  const poleMat = track(new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.6 }));
  const bulbGeo = track(new THREE.SphereGeometry(0.26, 12, 10));
  for (const l of map.lamps) {
    const pole = place(new THREE.Mesh(poleGeo, poleMat));
    pole.position.set(l.x, 2.1, l.z);
    pole.castShadow = true;

    const bulbMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfff0c0,
        emissive: l.color,
        emissiveIntensity: 0,
      }),
    );
    const bulb = place(new THREE.Mesh(bulbGeo, bulbMat));
    bulb.position.set(l.x, 4.3, l.z);
    lamps.push(bulb);

    // ★ PointLight က shadow မထုတ်ဘူး — မီးအိမ် ၁၀ လုံး × shadow map က
    // ဖုန်းအဟောင်းမှာ frame rate ကို ထက်ဝက်ချမယ်။
    const light = place(new THREE.PointLight(l.color, 0, 18, 2));
    light.position.set(l.x, 4.2, l.z);
    lampLights.push(light);
  }

  // ── မြို့လယ် screen — `live` link ရှိမှသာ ─────────────────────────────
  let screenMesh: THREE.Mesh | null = null;
  const link = map.gwaveLink;
  if (link && link.kind === "live") {
  const screenGeo = track(new THREE.PlaneGeometry(16, 9));
  const screenMat = track(
    new THREE.MeshBasicMaterial({ color: 0x11151f, side: THREE.DoubleSide }),
  );
  screenMesh = place(new THREE.Mesh(screenGeo, screenMat));
  screenMesh.position.set(link.x, 7.2, link.z);

  const frameGeo = track(new THREE.BoxGeometry(17, 10, 0.4));
  const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.6 }));
  const frame = place(new THREE.Mesh(frameGeo, frameMat));
  frame.position.set(link.x, 7.2, link.z - 0.3);
  colliders.push({
    minX: link.x - 8.5,
    maxX: link.x + 8.5,
    minZ: link.z - 0.6,
    maxZ: link.z + 0.1,
  });

  const legGeo = track(new THREE.BoxGeometry(0.6, 2.6, 0.6));
  for (const dx of [-6, 6]) {
    const leg = place(new THREE.Mesh(legGeo, frameMat));
    leg.position.set(link.x + dx, 1.3, link.z - 0.3);
    leg.castShadow = true;
  }
  }

  // ── ကောင်းကင်, နေ, ကြယ် ────────────────────────────────────────────────
  const hemi = place(new THREE.HemisphereLight(0x9fc6e8, 0x2a2f38, 0.6));
  const ambient = place(new THREE.AmbientLight(0xffffff, 0.35));

  const sun = place(new THREE.DirectionalLight(0xfff2d5, 1.1));
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  place(sun.target);

  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
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
  place(new THREE.Points(starGeo, starMat));

  const fog = new THREE.Fog(map.palette.fogDay, map.palette.fogNear, map.palette.fogFar);
  scene.fog = fog;

  // ── နေ့/ည ──────────────────────────────────────────────────────────────
  const SKY_NIGHT = new THREE.Color(map.palette.skyNight);
  const SKY_DUSK = new THREE.Color(map.palette.skyDusk);
  const SKY_DAY = new THREE.Color(map.palette.skyDay);
  const FOG_NIGHT = new THREE.Color(map.palette.fogNight);
  const FOG_DAY = new THREE.Color(map.palette.fogDay);

  const skyColor = new THREE.Color();
  const fogColor = new THREE.Color();
  scene.background = skyColor.clone();

  function updateSky(timeOfDay: number): number {
    const t = ((timeOfDay % 1) + 1) % 1;
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);

    sun.position.set(sunX * 60, sunY * 60, 20);
    sun.target.position.set(0, 0, 0);

    const day = THREE.MathUtils.clamp(sunY * 1.4 + 0.15, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(sunY) * 3.5, 0, 1);

    skyColor.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    skyColor.lerp(SKY_DUSK, dusk * 0.6);
    (scene.background as THREE.Color).copy(skyColor);

    fogColor.copy(FOG_NIGHT).lerp(FOG_DAY, day);
    fogColor.lerp(SKY_DUSK, dusk * 0.4);
    fog.color.copy(fogColor);
    fog.near = map.palette.fogNear * (0.75 + day * 0.25);
    fog.far = map.palette.fogFar * (0.62 + day * 0.38);

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

    return day;
  }

  updateSky(0.3);

  /// ★ ဝေးတဲ့အခန်းတွေကို ဖျောက်တယ် — အလင်းပါ ပိတ်ရမယ်၊ mesh ဖျောက်ရုံနဲ့
  /// PointLight က ဆက်တွက်နေဆဲ ဖြစ်တယ် (shader uniform ကုန်တယ်)။
  function updateInteriors(px: number, pz: number) {
    for (const it of interiors) {
      const near =
        Math.hypot(it.center.x - px, it.center.z - pz) < INTERIOR_VISIBLE_WITHIN;
      if (it.group.visible === near) continue;
      it.group.visible = near;
      for (const l of it.lights) l.visible = near;
    }
  }

  /// ★ အနီးဆုံး မီး ၂ ခုကိုသာ ဖွင့်ထားတယ်။ မီး ၆ ခုစလုံးရဲ့ PointLight
  /// ကို ဖွင့်ထားရင် fragment shader က မီးတိုင်းအတွက် ပြန်တွက်ရပြီး
  /// ဖုန်းအဟောင်းမှာ ရပ်သွားတယ် (browser မှာ တိုင်းတာပြီးသား)။
  const ACTIVE_FIRES = 2;
  const fireOrder: { f: (typeof fires)[number]; d: number }[] = [];

  function updateEffects(dt: number, t: number, wetness: number, px: number, pz: number) {
    water.update(t);
    if (fires.length === 0) return;

    fireOrder.length = 0;
    for (let i = 0; i < fires.length; i++) {
      const f = fires[i];
      if (!f) continue;
      fireOrder.push({ f, d: Math.hypot(f.group.position.x - px, f.group.position.z - pz) });
    }
    fireOrder.sort((a, b) => a.d - b.d);
    for (let i = 0; i < fireOrder.length; i++) {
      const entry = fireOrder[i];
      if (!entry) continue;
      entry.f.setActive(i < ACTIVE_FIRES && entry.d < 45);
      entry.f.setWet(wetness);
      entry.f.update(dt);
    }
  }

  function setShadows(enabled: boolean) {
    sun.castShadow = enabled;
  }

  function dispose() {
    for (const it of interiors) it.dispose();
    for (const o of added) scene.remove(o);
    for (const d of disposables) d.dispose();
    if (grid) {
      (grid.material as THREE.Material).dispose();
      grid.geometry.dispose();
    }
    scene.fog = null;
    scene.background = null;
  }

  return {
    colliders,
    lamps,
    lampLights,
    screenMesh,
    radius: R,
    walkRadius: map.walkRadius ?? R,
    updateSky,
    updateInteriors,
    water,
    updateEffects,
    ambient,
    setShadows,
    dispose,
  };
}

// ── အမိုးပုံစံများ ──────────────────────────────────────────────────────────
function makeRoof(
  kind: "gable" | "dome" | "pyramid",
  w: number,
  d: number,
  color: number,
  track: <T extends { dispose(): void }>(x: T) => T,
): THREE.Mesh | null {
  const mat = track(new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  if (kind === "pyramid") {
    const geo = track(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3, 4));
    const m = new THREE.Mesh(geo, mat);
    m.position.y = 1.5;
    m.rotation.y = Math.PI / 4;
    m.castShadow = true;
    return m;
  }
  if (kind === "dome") {
    const geo = track(new THREE.SphereGeometry(Math.max(w, d) * 0.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  }
  // gable — ဆလင်ဒါ ၃ မျက်နှာကို လှည့်ထားတာ (prism)
  const geo = track(new THREE.CylinderGeometry(w * 0.62, w * 0.62, d, 3));
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = Math.PI / 2;
  m.rotation.y = Math.PI / 2;
  m.position.y = 1.1;
  m.castShadow = true;
  return m;
}

// ── Terrain ────────────────────────────────────────────────────────────────
function buildTerrain(
  map: MapDef,
  place: <T extends THREE.Object3D>(o: T) => T,
  track: <T extends { dispose(): void }>(x: T) => T,
) {
  const t = map.terrain;
  if (t.kind === "flat") return;

  if (t.kind === "hills") {
    // ★ Segment ကို နည်းနည်းပဲ ထားတယ် (48×48) — ၂၅၆ ဆိုရင် vertex
    // ၆၅,၀၀၀ ဖြစ်ပြီး ဖုန်းအဟောင်းမှာ upload ရာမှာတင် ကြာမယ်။
    const geo = track(new THREE.PlaneGeometry(map.worldRadius * 2, map.worldRadius * 2, 48, 48));
    const pos = geo.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const h =
          Math.sin(x * t.frequency) * Math.cos(y * t.frequency) * t.amplitude;
        pos.setZ(i, h);
      }
      geo.computeVertexNormals();
    }
    const mat = track(new THREE.MeshLambertMaterial({ color: map.palette.ground }));
    const mesh = place(new THREE.Mesh(geo, mat));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.05;
    mesh.receiveShadow = true;
    return;
  }

  if (t.kind === "peaks") {
    const mat = track(
      new THREE.MeshStandardMaterial({ color: 0xf2f8fc, roughness: 0.9 }),
    );
    for (const p of t.peaks) {
      const geo = track(new THREE.ConeGeometry(p.r, p.h, 7));
      const cone = place(new THREE.Mesh(geo, mat));
      cone.position.set(p.x, p.h / 2 - 1, p.z);
      cone.castShadow = true;
      cone.receiveShadow = true;
    }
    return;
  }

  // islands — ပျံနေတဲ့ ကျွန်းများ
  const topMat = track(
    new THREE.MeshStandardMaterial({ color: map.palette.ground, roughness: 0.9 }),
  );
  const rockMat = track(new THREE.MeshStandardMaterial({ color: 0x6b5f7a, roughness: 0.95 }));
  for (const island of t.islands) {
    const topGeo = track(new THREE.CylinderGeometry(island.r, island.r * 0.92, 1.6, 16));
    const top = place(new THREE.Mesh(topGeo, topMat));
    top.position.set(island.x, island.y, island.z);
    top.receiveShadow = true;

    // အောက်ဘက် ချွန်တဲ့ ကျောက်တုံး — ပျံနေတဲ့ ခံစားချက်ရဖို့
    const rockGeo = track(new THREE.ConeGeometry(island.r * 0.9, island.r * 1.4, 9));
    const rock = place(new THREE.Mesh(rockGeo, rockMat));
    rock.position.set(island.x, island.y - island.r * 0.72, island.z);
    rock.rotation.x = Math.PI;
    rock.castShadow = true;
  }
}

// ── သစ်ပင်များ ─────────────────────────────────────────────────────────────
function buildTrees(
  map: MapDef,
  place: <T extends THREE.Object3D>(o: T) => T,
  track: <T extends { dispose(): void }>(x: T) => T,
  colliders: Collider[],
) {
  if (map.trees.length === 0) return;

  const trunkGeo = track(new THREE.CylinderGeometry(0.22, 0.3, 3, 6));
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
  const pineGeo = track(new THREE.ConeGeometry(1.6, 4.4, 7));
  const leafGeo = track(new THREE.SphereGeometry(1.8, 9, 7));
  const palmGeo = track(new THREE.SphereGeometry(1.5, 8, 5));

  const green = track(new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9 }));
  const pineGreen = track(new THREE.MeshStandardMaterial({ color: 0x235c33, roughness: 0.9 }));
  const palmGreen = track(new THREE.MeshStandardMaterial({ color: 0x4aa85a, roughness: 0.85 }));

  for (const t of map.trees) {
    const trunk = place(new THREE.Mesh(trunkGeo, trunkMat));
    trunk.position.set(t.x, 1.5 * t.scale, t.z);
    trunk.scale.setScalar(t.scale);
    trunk.castShadow = true;

    if (t.kind !== "bare") {
      const geo = t.kind === "pine" ? pineGeo : t.kind === "palm" ? palmGeo : leafGeo;
      const mat = t.kind === "pine" ? pineGreen : t.kind === "palm" ? palmGreen : green;
      const crown = place(new THREE.Mesh(geo, mat));
      crown.position.set(t.x, (t.kind === "pine" ? 4.4 : 4) * t.scale, t.z);
      crown.scale.setScalar(t.scale);
      crown.castShadow = true;
    }

    // ★ ပင်စည်က အစိုင်အခဲ — ဖြတ်လျှောက်လို့ မရရ။ ဒါပေမယ့် collider က
    // ပင်စည်အရွယ်သာ ဖြစ်ရမယ်၊ အရွက်အထိ ယူရင် သစ်ပင်နားက လမ်းတွေ
    // ပိတ်နေမယ်။
    const r = 0.4 * t.scale;
    colliders.push({ minX: t.x - r, maxX: t.x + r, minZ: t.z - r, maxZ: t.z + r });
  }
}

/// နံရံနဲ့ တိုက်မိမှုကို ဖြေရှင်း — ★ x နဲ့ z ကို **သီးခြားစီ** စစ်တယ်။
///
/// နှစ်ခုတွဲစစ်ရင် နံရံကို ထောင့်စောင်းတိုးမိတာနဲ့ လုံးဝရပ်သွားမယ် (ကပ်နေသလို)။
/// သီးခြားစစ်ရင် တိုက်တဲ့ဝင်ရိုးကိုပဲ ပိတ်ပြီး ကျန်တစ်ခုက ဆက်ရွှေ့လို့ရလို့
/// နံရံတလျှောက် ဘေးတိုက်လျှောသွားတယ် — Roblox/GTA မှာ ခံစားရတဲ့အတိုင်း။
/// နေရာတစ်ခုက collider (AABB + player radius) ထဲမှာလား — ယာဉ်ဆင်းချိန်
/// လွတ်တဲ့နေရာ ရွေးဖို့နဲ့ resolveCollision ရဲ့ unstick စစ်ချက်မှာ သုံးတယ်။
export function insideCollider(
  px: number,
  pz: number,
  colliders: Collider[],
): boolean {
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
}

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

  const hits = (px: number, pz: number) => insideCollider(px, pz, colliders);

  // ★★ လက်ရှိနေရာကိုက collider ထဲမှာ ရှိနေပြီးသားဆိုရင် (ယာဉ်ဆင်းချိန်/
  //   teleport က ချလိုက်တာ) **ပိတ်မထားဘူး** — ပိတ်ရင် ဘယ်ဘက်ကိုမှ
  //   မရွှေ့နိုင်တော့ဘဲ ထာဝရ ကပ်နေတယ်။ လွတ်တဲ့နေရာ ပြန်ရောက်တာနဲ့
  //   ပုံမှန် collision ပြန်စတယ်။
  if (!hits(oldX, oldZ)) {
    if (hits(x, oldZ)) x = oldX;
    if (hits(x, z)) z = oldZ;
  }

  const r = Math.hypot(x, z);
  const limit = worldRadius - 2;
  if (r > limit) {
    x = (x / r) * limit;
    z = (z / r) * limit;
  }

  return { x, z };
}
