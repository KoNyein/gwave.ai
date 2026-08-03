# GWAVE ARENA — Design & Technology Spec

> `GWAVE_ASSASSIN_INTEGRATION.md` (Phase A1–A9) ၏ အဆက်။
> ဤစာတမ်းသည် **၃ ခုကို ဆုံးဖြတ်ပေးသည်** —
> ၁။ Combat model (netcode ရိုးရှင်းစေရန်)
> ၂။ 3D rendering နည်းပညာ
> ၃။ UI/UX design system အပြည့်အစုံ
>
> Claude Code သည် Phase A1–A9 ကို အကောင်အထည်ဖော်ရာတွင် ဤစာတမ်းပါ ဆုံးဖြတ်ချက်များအတိုင်း လိုက်နာရမည်။

---

# ၀။ ★ အဓိကဆုံးဖြတ်ချက် ၃ ခု (အကျဉ်း)

| # | ဆုံးဖြတ်ချက် | အကြောင်းရင်း |
|---|---|---|
| 1 | **လက်နက်အားလုံး projectile — hitscan လုံးဝမသုံး** | Lag compensation တစ်ခုလုံး မလိုတော့။ Ping 200ms ဖုန်းသုံးသူတွေ တန်းတူယှဉ်ပြိုင်နိုင် |
| 2 | **Cosmetic-only ကို default** | ဝယ်နိုင်သူပဲနိုင်ရင် ကစားသမားအသစ် မကျန်။ ကာကွယ်မှုကို map pickup ကနေရအောင် |
| 3 | **Mode ၃ မျိုးကို အဆင့်လိုက်ထုတ်** | ဝှက်တမ်း → အပြေးပြိုင် → Assassin။ ရိုးရှင်းတာက အရင်၊ infrastructure တူတူသုံး |

---

# အပိုင်း ၁ — ★ Projectile Combat Model

## 1.1 ဘာလို့ hitscan မသုံးတာလဲ

```
【Hitscan】ပစ်တာနဲ့ ချက်ချင်းထိ
  → Server မှာ ကစားသမားနေရာ history သိမ်းရ (rewind)
  → Ping အလိုက် ၂၅၀ms အထိ ပြန်ခေါ်ရ
  → "ကွယ်ပြီးသားမှာ သေတယ်" ဆိုတဲ့ ခံစားချက်ဖြစ်
  → Code ရှုပ်၊ bug များ၊ cheat ကာကွယ်ရခက်

【Projectile】ကျည်က ပျံသွားတယ်
  → Server က ပုံမှန် simulate လုပ်ရုံ — rewind မလို ★
  → ကစားသမားနှစ်ဦးလုံး "ကျည်ပျံနေတာ" မြင်ရ — မျှတမှုရှိ
  → ရှေ့မှန်းပစ်ရတဲ့ ကျွမ်းကျင်မှု ဖြစ်လာ
  → ★ Ping မြင့်သူတွေအတွက် သိသိသာသာ ပိုမျှတ
```

> ★ Mae Sot ဘက်က ဖုန်းသုံးသူတွေရဲ့ ping က ၈၀–၂၅၀ms ဖြစ်တတ်တယ်။ Hitscan ဆိုရင် ping နည်းသူပဲ အမြဲနိုင်မယ်။ Projectile က ဒီပြဿနာကို **အခြေခံကနေ** ဖျောက်ပစ်တယ်။

## 1.2 လက်နက် ၅ မျိုး

| လက်နက် | အမျိုးအစား | အမြန် | ထိခိုက်မှု | ကျည် | ပြန်ဖြည့် | အထူးလက္ခဏာ |
|---|---|---|---|---|---|---|
| 🔫 **ပစ္စတို** | projectile | 62 m/s | 30 | 12 | 1.6s | အခြေခံ · မြေဆွဲအား နည်းနည်း |
| 🎯 **ရိုင်ဖယ်** | projectile | 105 m/s | 42 | 8 | 2.2s | ★ ဦးတည်ချိန် 0.5s လိုတယ် |
| 🗡 **ဓား** | melee | — | 70 | ∞ | — | 2.4m · ★ နောက်ကျောကနေဆို ၁၀၀ |
| 🏹 **လေးမြား** | arc projectile | 45 m/s | 55 | 6 | 2.0s | ★ တိတ်ဆိတ် — ပစ်သံမကြားရ |
| 💣 **ဗုံး** | arc + fuse | 16 m/s | 85 | 2 | 6s | 2.5s မီးစာ · 5m အကျယ် |

**★ ဒီဇိုင်းယုတ္တိ**
- ပစ္စတိုက အမြဲရ — ကျွမ်းကျင်မှုမလို
- ရိုင်ဖယ်က အားကောင်း ဒါပေမယ့် **ချိန်နေရင် ရွေ့လို့မရ** (အန္တရာယ်ရှိ)
- ဓားက အနီးကပ် — **နောက်ကျောကနေ တစ်ချက်သတ်** ဆိုတာ assassin game ရဲ့ အနှစ်သာရ
- လေးမြားက **ပစ်သံမထွက်** — ပုန်းသတ်ချင်သူအတွက်
- ဗုံးက နေရာပိတ်ဖို့ — တိုက်ရိုက်သတ်ဖို့မဟုတ်

## 1.3 Server Simulation

```ts
// shared/combat/projectile.ts — ★ client နဲ့ server တစ်ခုတည်းက import
export type Projectile = {
  id: number;
  ownerId: string;
  weapon: WeaponId;
  pos: Vec3; vel: Vec3;
  spawnedAt: number;
  gravity: number;        // ပစ္စတို 2.5 · လေးမြား 9.8 · ဗုံး 14
  ttlMs: number;
  radius: number;         // 0.06 – 0.12
};

/** ★ Fixed timestep — client/server တူညီရမယ် */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

export function stepProjectile(p: Projectile, dt: number, world: WorldQuery): HitResult | null {
  const steps = Math.ceil(dt / SIM_DT);
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const prev = { ...p.pos };
    p.vel.y -= p.gravity * h;
    p.pos.x += p.vel.x * h; p.pos.y += p.vel.y * h; p.pos.z += p.vel.z * h;

    // ★ Swept test — အမြန်နှုန်းများရင် frame ကြားက ကျော်သွားတာကာကွယ်
    const hit = world.sweep(prev, p.pos, p.radius, p.ownerId);
    if (hit) return hit;
    if (p.pos.y < 0) return { kind: 'ground', point: { ...p.pos } };
  }
  return null;
}
```

**★ Server tick** — projectile ကို **60Hz** နဲ့ simulate ပြီး snapshot ကို **20Hz** နဲ့ပို့တယ်။ Simulation တိကျမှုနဲ့ bandwidth နှစ်ခုလုံးရတယ်။

## 1.4 Client Prediction (ကျည်အတွက်)

```ts
/* ★ ကိုယ်ပစ်တဲ့ကျည်ကို ချက်ချင်းပြ (server မစောင့်) —
   server က အတည်ပြုပြီး id ပြန်လာရင် ချိတ်ဆက်
   မှားရင် ကျည်ပျောက်သွားရုံ — ထိခိုက်မှုက server ကသာဆုံးဖြတ် */
function fireLocal(weapon: WeaponId, origin: Vec3, dir: Vec3) {
  const localId = --localSeq;                    // ★ အနုတ် = local
  spawnTracer({ id: localId, ...predictProjectile(weapon, origin, dir) });
  net.send({ type: 'fire', seq: ++inputSeq, weapon, origin, dir });
}

function onServerProjectile(msg) {
  const local = tracers.find(t => t.id < 0 && t.ownerId === myId && t.weapon === msg.weapon);
  if (local) { local.id = msg.id; local.pos = msg.pos; }   // ★ ချိတ်ဆက်
  else spawnTracer(msg);
}
```

## 1.5 Hitbox (server-side သာ)

```ts
export const HITBOX = {
  head: { kind: 'sphere',  c: [0, 1.72, 0], r: 0.23, mult: 2.0 },
  body: { kind: 'capsule', a: [0, 0.88, 0], b: [0, 1.52, 0], r: 0.31, mult: 1.0 },
  legs: { kind: 'capsule', a: [0, 0.06, 0], b: [0, 0.88, 0], r: 0.23, mult: 0.7 },
} as const;
```

**★ နောက်ကျောထိုးချက်** — ဓားနဲ့သတ်တဲ့အခါ ပစ်မှတ်ရဲ့ `ry` နဲ့ တိုက်သူရဲ့ဦးတည်ချက် ထောင့်ကွာဟမှု < 70° ဆိုရင် **ထိခိုက်မှု ၁၀၀** (တစ်ချက်သတ်)။ Server မှာသာ တွက်ရမယ်။

## 1.6 Anti-Cheat (projectile နဲ့ ရိုးရှင်းသွားပုံ)

| Cheat | Hitscan မှာ | ★ Projectile မှာ |
|---|---|---|
| Aimbot | ကာကွယ်ရခက် | ★ ရှေ့မှန်းပစ်ရလို့ အလိုအလျောက်ခက် |
| Wallhack ပစ်တာ | occlusion စစ်ရ | ★ ကျည်က နံရံမှာ ကိုယ်တိုင်ရပ် |
| Lag switch | အလွန်ထိရောက် | ★ အကျိုးမရှိ (ကျည်က server မှာပျံ) |
| Speed hack | movement စစ် | တူညီ |
| Rapid fire | cooldown | တူညီ |

★ **Interest management** (၄၀ unit ကျော် နေရာမပို့) ကို မဖြစ်မနေထည့်ရမယ် — ဒါက radar/ESP hack ကို အခြေခံကနေတားတယ်။

## 1.7 ★ ကာကွယ်မှုကို gameplay ကနေရအောင်

```
❌ Skin ဝယ်ရင် armor တိုး  → ဝယ်နိုင်သူပဲနိုင်

✅ Map ထဲမှာ armor pickup ချထား —
   · သံချပ် (+35 armor)  — ဗဟိုနေရာ၊ ၄၅s တစ်ခါပေါ်  ★ လုယူရတဲ့နေရာ
   · ခေါင်းစွပ် (+25)     — ထောင့်နေရာ၊ ၃၀s
   · ဆေးဘူး (+40 hp)     — ၃ နေရာ၊ ၂၅s

   → ကစားသမားတိုင်း တန်းတူရနိုင်
   → ★ Pickup နေရာက တွေ့ဆုံမှုဖြစ်စေတယ် (game design အရ ကောင်း)
```

`COMBAT_BALANCE.mode` ကို `'cosmetic'` ထား — skin က **အရောင်/ပုံစံပဲ** ကွာမယ်။

---

# အပိုင်း ၂ — Mode Framework (အဆင့်လိုက်ထုတ်ရန်)

Room type `'game'` တစ်ခုတည်းအောက်မှာ mode ၃ မျိုး။ Infrastructure (lobby, snapshot, HUD shell) တူတူသုံးလို့ mode အသစ်ထည့်ရ လွယ်တယ်။

```ts
export interface GameMode {
  id: 'hide' | 'race' | 'assassin';
  nameMy: string;
  minPlayers: number; maxPlayers: number;
  usesCombat: boolean;              // ★ hide/race မှာ false
  onStart(m: Match): void;
  onTick(m: Match, dt: number): void;
  onPlayerAction(m: Match, p: MatchPlayer, a: unknown): void;
  checkEnd(m: Match): GameResult | null;
}
```

| အဆင့် | Mode | ကြာချိန် | Combat | ခန့်မှန်း |
|---|---|---|---|---|
| **၁** | 🙈 **ဝှက်တမ်း** (ရှာဖွေသူ ၁ vs ပုန်းသူများ) | 5 မိနစ် | ❌ | 6 ရက် |
| **၂** | 🏁 **အပြေးပြိုင်** (checkpoint 6 ခု) | 3 မိနစ် | ❌ | 4 ရက် |
| **၃** | 🎯 **Assassin** (ပစ်မှတ် ၃ ယောက်) | 8 မိနစ် | ✅ | 12 ရက် |

> ★ **ဝှက်တမ်းကို အရင်ထုတ်ရတဲ့အကြောင်း** — Combat မလို၊ netcode ရိုးရှင်း၊ ကစားသမား ၄ ယောက်နဲ့တောင် ပျော်စရာကောင်း၊ ဒါပေမယ့် lobby/match/snapshot/HUD အားလုံးကို စမ်းသပ်ပြီးသားဖြစ်သွားတယ်။ Assassin ရောက်တဲ့အခါ အခြေခံအားလုံး ခိုင်နေပြီ။

**Mode ၃ ခုလုံး တူညီစွာသုံးသည့်အရာများ** — Room · Lobby · Snapshot networking · Avatar/gear · Scoreboard · Result panel · Persistence · HUD shell

---

# အပိုင်း ၃ — 3D Rendering Technology

## 3.0 ★ စွမ်းဆောင်ရည် ရည်မှန်းချက် (ဒါက ဒီဇိုင်းကို ဆုံးဖြတ်တယ်)

| Device | ရည်မှန်း | Draw call | Triangle |
|---|---|---|---|
| ဖုန်းအလယ်အလတ် (Snapdragon 6xx) | **30 fps** | < 90 | < 180k |
| ဖုန်းအသစ် | 60 fps | < 150 | < 400k |
| Desktop | 60+ fps | < 250 | < 900k |

> ★ **အခြေခံမူ** — ဖုန်းအဟောင်းက အဓိကပရိသတ်။ လှတာထက် **ချောမွေ့တာ** ပိုအရေးကြီးတယ်။ Effect တိုင်းကို ပိတ်လို့ရအောင်ထားပါ။

## 3.1 Material — Toon + Rim (Arena ၏ ကိုယ်ပိုင်ပုံရိပ်)

Arena က social map တွေနဲ့ **အမြင်အားဖြင့် ခွဲခြားသိသာရမယ်** — ယွန်းထည်ပုံစံ (အနက်၊ ဟင်္သပဒါး၊ ရွှေ)။

```ts
/** ★ MeshToonMaterial + gradient 3 ဆင့် + rim light
 *  onBeforeCompile နဲ့ rim ထည့်တာက material အသစ်မရေးရဘဲ ရတယ် */
export function lacquerToon(THREE, color: number, opts = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: TOON_3STEP, ...opts });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(0xc9a227) };  // ★ ရွှေ rim
    shader.uniforms.rimPower = { value: 3.2 };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 rimColor; uniform float rimPower;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        // ★ အနားစွန်းမှာ ရွှေရောင်တောက် — ယွန်းထည်ခံစားချက်
        float rim = pow(1.0 - max(dot(normalize(vViewPosition), vNormal), 0.0), rimPower);
        gl_FragColor.rgb += rimColor * rim * 0.55;`);
  };
  return m;
}
```

**Outline** — ★ **ဇာတ်ကောင်နဲ့ pickup မှာသာ** (အဆောက်အအုံမှာ မထည့်ရ — draw call ၂ ဆဖြစ်တယ်)

```ts
/** BackSide inverted hull — ဇာတ်ကောင်အတွက်သာ
 *  ★ ဖုန်းအဟောင်းမှာ ပိတ်လို့ရရမယ် */
const OUTLINE_BUDGET = { characters: true, pickups: true, props: false, buildings: false };
```

## 3.2 Geometry — Instancing နဲ့ Merging

```ts
/* ★ တူညီတဲ့ prop တွေကို InstancedMesh —
   ကျောက်တုံး ၂၀၀ = draw call ၁ ခု (၂၀၀ မဟုတ်) */
const rocks = new THREE.InstancedMesh(rockGeo, lacquerToon(THREE, 0x2f3a35), 200);
for (let i = 0; i < 200; i++) rocks.setMatrixAt(i, m4.compose(pos[i], quat[i], scale[i]));
rocks.instanceMatrix.setUsage(THREE.StaticDrawUsage);

/* ★ ရွေ့လျားမှုမရှိတဲ့ geometry တွေကို merge —
   BufferGeometryUtils.mergeGeometries() */
const staticWorld = mergeGeometries(buildingGeos);   // draw call ၁ ခုတည်း
```

**Budget** — Arena တစ်ခုလုံး static geometry **draw call ၈ ခုအောက်** (material အလိုက်ခွဲ)

## 3.3 ★ Texture — Atlas + KTX2

```
❌ Texture ၄၀ ခု သီးခြား  → draw call ၄၀ · memory ၈၀MB
✅ Atlas ၂ ခု (2048²) + KTX2  → draw call ၂ · memory ~12MB  ★ ၈၅% လျော့
```

```bash
# KTX2 (Basis Universal) ပြောင်းနည်း
npx @gltf-transform/cli optimize arena.glb arena.opt.glb \
  --texture-compress ktx2 --texture-size 1024 --compress draco
```

```ts
const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
loader.setKTX2Loader(ktx2);
```

> ★ **ဖုန်းအတွက် အကျိုးအရှိဆုံး optimization က ဒါပါပဲ** — texture memory က ဖုန်းအဟောင်းတွေ crash ဖြစ်ရတဲ့ အဓိကအကြောင်းရင်း။

## 3.4 ★ Lighting — Baked + Dynamic ခွဲ

```
Static (အဆောက်အအုံ၊ မြေ)  → ★ Lightmap baked (Blender ကနေ)
                              real-time light မလို၊ လှပြီး အခမဲ့

Dynamic (ဇာတ်ကောင်)        → DirectionalLight ၁ ခု + shadow
                              ★ Shadow camera ကို ကစားသမားပတ်လည် ၂၅ unit ပဲ

Point light                → ★ ၄ ခုအထိသာ (ဗုံးပေါက်ကွဲမှု၊ ပစ်မှတ်အလင်း)
                              ဖုန်းအဟောင်းမှာ ၀ ခု
```

```ts
/* ★ Shadow camera ကို ကစားသမားနဲ့လိုက်ရွှေ့ — map တစ်ခုလုံးမဖုံးရ
   ဒါက shadow အရည်အသွေး ၄ ဆတိုးပြီး ကုန်ကျစရိတ်တူတူ */
function updateShadowFrustum(sun, playerPos) {
  sun.target.position.copy(playerPos);
  sun.position.copy(playerPos).add(SUN_OFFSET);
  sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;   sun.shadow.camera.bottom = -25;
  sun.shadow.camera.updateProjectionMatrix();
}
```

## 3.5 LOD & Culling

```ts
/** ဇာတ်ကောင် LOD ၃ ဆင့် — ★ mesh မဟုတ်ဘဲ လုပ်ဆောင်ချက် LOD */
function characterLOD(dist: number) {
  if (dist < 18) return { skin: true,  anim: 60, outline: true,  shadow: true  };
  if (dist < 40) return { skin: true,  anim: 20, outline: false, shadow: false };
  return           { skin: false, anim: 0,  outline: false, shadow: false };  // ★ billboard
}
```

**Culling ၃ ဆင့်**
1. **Frustum** — three.js က အလိုအလျောက်
2. **★ Zone culling** — Arena ကို zone ၅ ခုခွဲထားပြီး zone graph နဲ့ မမြင်ရတဲ့ zone ကို `visible=false`
3. **★ Network culling** — ၄၀ unit ကျော် server က data မပို့ (cheat ကာကွယ်မှုလည်းဖြစ်)

## 3.6 Effects — Pooled & Cheap

```ts
/* ★ Object pooling မဖြစ်မနေ — ပစ်တိုင်း mesh အသစ်ဆောက်ရင်
   GC pause ဖြစ်ပြီး frame ကျတယ် */
class Pool<T> {
  private free: T[] = [];
  constructor(private make: () => T, private reset: (t: T) => void, size: number) {
    for (let i = 0; i < size; i++) this.free.push(make());
  }
  get(): T { return this.free.pop() ?? this.make(); }
  release(t: T) { this.reset(t); this.free.push(t); }
}

export const POOLS = {
  tracer:   new Pool(makeTracer, resetTracer, 64),      // ★ ကျည်လမ်းကြောင်း
  impact:   new Pool(makeImpact, resetImpact, 32),      // ထိမှတ်
  decal:    new Pool(makeDecal,  resetDecal,  48),      // ★ ကျည်ချောက် (48 ကျော်ရင် အဟောင်းပြန်သုံး)
  dmgText:  new Pool(makeDmgEl,  resetDmgEl,  24),
};
```

**Particle** — `THREE.Points` + additive blending၊ shader မှာ animate (CPU မှာမဟုတ်)

```ts
/* ★ ပေါက်ကွဲမှု particle ၁၂၀ ခုကို attribute တစ်ခါတည်းသတ်မှတ်ပြီး
   vertex shader မှာ အချိန်အလိုက်ရွှေ့ — CPU မထိ */
```

**Post-processing — ★ ဖုန်းအတွက် ရွေးချယ်မှု**

| Effect | Desktop | ဖုန်းအသစ် | ဖုန်းအဟောင်း |
|---|---|---|---|
| Bloom (UnrealBloom) | ✅ | ⚠️ လျှော့ | ❌ |
| ★ Vignette + LUT grade | ✅ | ✅ | ✅ (ဈေးပေါ) |
| FXAA | ✅ | ✅ | ❌ |
| SSAO | ❌ (မလို) | ❌ | ❌ |

> ★ **LUT color grading က bloom ထက် အကျိုးများတယ်** — ကုန်ကျစရိတ် နီးပါးမရှိဘဲ ယွန်းထည်ခံစားချက် (အနက်နက်၊ ဟင်္သပဒါးတောက်) ကို တစ်ခါတည်းရတယ်။ 32×32×32 LUT texture တစ်ခုပဲလိုတယ်။

## 3.7 Adaptive Quality (★ မဖြစ်မနေ)

```ts
/** FPS စောင့်ကြည့်ပြီး အလိုအလျောက်လျှော့/တိုး
 *  ★ User မသိလိုက်ဘဲ ချောမွေ့နေအောင် */
const TIERS = [
  { name: 'high',   pixelRatio: 2,   shadow: 2048, bloom: true,  outline: true,  particles: 1.0 },
  { name: 'medium', pixelRatio: 1.5, shadow: 1024, bloom: false, outline: true,  particles: 0.6 },
  { name: 'low',    pixelRatio: 1,   shadow: 512,  bloom: false, outline: false, particles: 0.3 },
  { name: 'potato', pixelRatio: 0.8, shadow: 0,    bloom: false, outline: false, particles: 0.1 },
];

/* ★ ၃ စက္ကန့်ဆက်တိုက် < 26fps → တစ်ဆင့်လျှော့
   ၁၀ စက္ကန့်ဆက်တိုက် > 55fps → တစ်ဆင့်တိုး (တစ်ခါပဲ) */
```

## 3.8 Asset Pipeline

```
Blender → glTF → gltf-transform (draco + ktx2 + prune) → S3/CloudFront
                                                          ↓
                                          ★ Cache-Control: max-age=31536000
                                             (filename မှာ hash ထည့်)
```

**Budget** — Arena map GLB **< 4 MB** · ဇာတ်ကောင် **< 800 KB** · Texture atlas **< 3 MB**

## 3.9 WebGPU (အနာဂတ်)

```ts
/* ★ three.js r160+ မှာ WebGPURenderer ရှိပြီ။ ဒါပေမယ့် —
   · မြန်မာဘက် ဖုန်းအများစုမှာ မရသေး
   · WebGL2 fallback မဖြစ်မနေလို
   → feature flag နဲ့ထား၊ default ပိတ် */
const USE_WEBGPU = flags.webgpu && 'gpu' in navigator;
```

## 3.10 Acceptance Criteria

- [ ] ★ Snapdragon 6xx ဖုန်းမှာ 30fps တည်ငြိမ် (ကစားသမား ၁၂ ယောက်)
- [ ] Static geometry draw call < 8
- [ ] Texture memory < 15 MB
- [ ] ★ Adaptive quality အလိုအလျောက်အလုပ်လုပ်
- [ ] Effect အားလုံး pooled — ပစ်ရင် GC pause မဖြစ်
- [ ] ၄၀ unit ကျော် ဇာတ်ကောင် skinning မလုပ်
- [ ] Arena GLB < 4 MB
- [ ] Shadow camera ကစားသမားနဲ့လိုက်ရွှေ့
- [ ] ★ Effect တိုင်း settings ကနေပိတ်လို့ရ
- [ ] WebGL context lost ရင် ပြန်တည်ဆောက်

---

# အပိုင်း ၄ — ★ UI/UX Design System

## 4.0 Design Brief (အရင်ဆုံး သတ်မှတ်ချက်)

```
ဘာလဲ    — မြန်မာဘာသာ metaverse ထဲက ပစ်မှတ်လိုက်ရှာသည့် အခန်း
ဘယ်သူ   — Mae Sot ဘက်က ဖုန်းသုံးသူများ (တောင်သူ၊ ဆိုင်ရှင်၊ ကျောင်းသား)
           ★ FPS game ကျွမ်းကျင်သူများ မဟုတ်
HUD ၏ တာဝန် (တစ်ခုတည်း) —
   ၁။ ငါ့ပစ်မှတ်က ဘယ်သူလဲ
   ၂။ ငါ အန္တရာယ်ရှိနေပြီလား
   ၃။ အခု ပစ်လို့ရပြီလား
   ★ ကျန်တာအားလုံး ဒုတိယနေရာ
```

## 4.1 ★ Design Plan

### အရောင် — ယွန်းထည် (Burmese Lacquerware)

Social map တွေက စာအုပ်ရောင်စဉ် (နွေးထွေး၊ ဖျော့ဖျော့)။ Arena က **လုံးဝဆန့်ကျင်ဘက်** ဖြစ်ရမယ် — အန္တရာယ်ခံစားချက်။ မြန်မာယွန်းထည်ရဲ့ အနက်-ဟင်္သပဒါး-ရွှေ က ဒေသနဲ့လည်းကိုက်ပြီး ခွဲခြားသိသာမှုလည်းရတယ်။

```css
--lac-board:   #14181a;   /* ယွန်းအနက် — HUD နောက်ခံ */
--lac-panel:   #1e2528;   /* အလွှာ */
--lac-ink:     #e6e0cf;   /* ထုံးဖြူ — အဓိကစာသား */
--lac-muted:   #8a8674;   /* ဒုတိယစာသား */
--lac-jade:    #5f9e8f;   /* ကျောက်စိမ်း — ဘေးကင်း၊ ကိုယ့်ဘက် */
--lac-gold:    #c9a227;   /* ရွှေ — အောင်မြင်မှု၊ အမှတ် */
--lac-cinnabar:#d1402f;   /* ★ ဟင်္သပဒါး — အန္တရာယ်/ပစ်မှတ်အတွက်သာ */
```

> ★ **စည်းကမ်းတစ်ခု — ဟင်္သပဒါးရောင်ကို ပစ်မှတ်နဲ့ အန္တရာယ်အတွက်သာ သုံးရမယ်။**
> ခလုတ်၊ အနားသတ်၊ အလှဆင်မှုမှာ လုံးဝမသုံးရ။ ဒါမှ မြင်လိုက်တာနဲ့ အဓိပ္ပာယ်ရှိမယ်။

### စာလုံး

| အခန်းကဏ္ဍ | ဖောင့် | သုံးရာ |
|---|---|---|
| **Display** | ★ ထူထဲသော slab (Alfa Slab One / Rye) — Latin သာ | ကြေညာစာ ခေါင်းစီး၊ အနိုင်ရမှု |
| **UI** | Padauk / Noto Sans Myanmar | မြန်မာစာအားလုံး |
| **Numeric** | ★ tabular mono | ကျည်၊ HP၊ အချိန်၊ အမှတ် |

★ **Tabular mono မဖြစ်မနေ** — ကျည် `12 → 9 → 8` ပြောင်းတိုင်း အကျယ်မတူရင် တုန်နေတယ်။

```css
--fs-micro: 10px; --fs-sm: 12px; --fs-base: 14px;
--fs-lg: 18px; --fs-xl: 26px; --fs-display: 40px;
```

### ★ Signature Element — **ကြေညာစာ (Wanted Poster)**

ဒါက ဒီ UI ကို မှတ်မိစေမယ့် တစ်ခုတည်းသောအရာ။

```
ပစ်မှတ်အသစ်ရရင် — ကြေညာစာတစ်ရွက် ဖန်သားပြင်ပေါ် "ဖျတ်" ကနဲ ကျလာ
(scale 1.4 → 1.0, ကွေးကွေးလေးလှည့်, 420ms) ၂ စက္ကန့်နေပြီး
ညာဘက်အပေါ်ထောင့်ကို သေးသေးလေးဖြစ်သွား — ပင်နဲ့ချိတ်ထားသလို

┌───────────────────────┐
│  ╱╲  ရှာဖွေရန်  ╱╲     │   ← display font, ရွှေရောင်
│ ┌─────────────────┐   │
│ │   [avatar ပုံ]   │   │   ← ★ ပစ်မှတ်ရဲ့ တကယ့် avatar
│ └─────────────────┘   │
│    ကိုမောင်မောင်        │   ← Padauk bold
│  ━━━━━━━━━━━━━━━━━   │
│   ဆု ၁ အမှတ်          │
└───────────────────────┘
     ▲ ပင်ချိတ် (ink stamp)
```

★ ဘာလို့ကောင်းလဲ — (၁) Game ရဲ့အနှစ်သာရကို တိုက်ရိုက်ဖော်ပြ (၂) Metaverse ရဲ့ စက္ကူ/မင် ပစ္စည်းလောကနဲ့ ဆက်စပ် (၃) ပစ်မှတ်ကို **မျက်နှာနဲ့** မှတ်မိစေတယ် (နာမည်ထက် မြန်) (၄) တခြား game တွေမှာ မတွေ့ရ

### ★ ဒုတိယ signature — မင်စက် (Ink Blot) ဒဏ်ရာ

ပုံမှန် FPS က အနီရောင် vignette သုံးတယ်။ ဒီမှာ **မင်စက်တွေ ဖန်သားပြင်အနားမှာ ဖြန့်လာတယ်** — ထိတိုင်း တိုးလာ၊ ကျန်းမာလာရင် ပြန်ခြောက်သွား။ ဟင်္သပဒါးရောင်၊ ပန်းချီဆန်ဆန်။

## 4.2 ★ Layout — လက်မဇုန် (Thumb Zone)

ဖုန်းကို လက်နှစ်ဖက်နဲ့ရှည်လျားစွာကိုင်ထားချိန် လက်မ ၂ ချောင်းရောက်နိုင်တဲ့နေရာက **အောက်ထောင့် ၂ ဖက်ပဲ**။

```
┌─────────────────────────────────────────┐
│ ⏱ 4:12          [ကြေညာစာ]      🏆 1/3  │ ← ★ အချက်အလက်သာ (နှိပ်စရာမဟုတ်)
│                                          │
│                                          │
│                    ✛                     │ ← crosshair
│                                          │
│                                          │
│  ❤ 78 ▓▓▓▓▓▓▓░░                    🔫12 │ ← အခြေအနေ
│  🛡 25 ▓▓▓░░░░░░░                   ▮▮▮▮ │
│                                          │
│  ╭───────╮                    ╭───────╮  │
│  │  ⊙    │                    │  ပစ်  │  │ ← ★ လက်မဇုန်
│  ╰───────╯                    ╰───────╯  │
│   joystick              💣  🗡   [ပစ်]    │
└─────────────────────────────────────────┘
```

**စည်းမျဉ်း ၄ ချက်**
1. ★ နှိပ်စရာအားလုံး **အောက် ၃၅%** မှာသာ
2. ★ Crosshair ပတ်လည် ၁၂၀px ကို **ဘာမှမထား** (မြင်ကွင်းလွတ်ရမယ်)
3. ★ ကြေညာစာက အပေါ်ဗဟို — ဖုန်းကိုင်ထားရင် လက်နဲ့မဖုံး
4. ★ ခလုတ်အနည်းဆုံး **48×48px** (44 က အနိမ့်ဆုံး၊ ဒီမှာ ရွေ့လျားနေလို့ ၄၈)

## 4.3 Component များ

### (၁) TargetPoster — ★ signature

| အခြေအနေ | အပြုအမူ |
|---|---|
| ပစ်မှတ်အသစ် | ★ ကြီးကြီးကျလာ (420ms) → ၂s → ထောင့်သို့ |
| ပုံမှန် | ထောင့်မှာ ၈၄px — avatar + နာမည် |
| ★ မမြင်ရ | မှိန် 55% |
| ★ မြင်ရ | ပြည့် + ဟင်္သပဒါး အနားရောင်တောက် (pulse 1.2s) |
| ပစ်မှတ်သေပြီ | ★ "ပြီးပြီ" တံဆိပ်တုံး ရိုက်ချ (stamp animation) |

```tsx
/* ★ ပစ်မှတ်မြင်ရလား — server က မပြောရ (wallhack ဖြစ်မယ်)
   Client မှာ ကိုယ့်မြင်ကွင်းထဲရှိမရှိ ကိုယ်တိုင်စစ် */
const visible = isInFrustum(targetPos) && !isOccluded(myPos, targetPos);
```

### (၂) VitalsStrip — ကျန်းမာရေး + ကာကွယ်မှု

```
❤ 78  ▓▓▓▓▓▓▓░░░       ← ကျောက်စိမ်း → ရွှေ → ဟင်္သပဒါး
🛡 25  ▓▓▓░░░░░░░       ← armor ရှိမှသာပေါ်
```
- ★ ကိန်းဂဏန်းရော bar ရော ပြ (bar က မြန်၊ ကိန်းက တိကျ)
- ★ HP < 30 → bar က ၁.၄s တစ်ခါ တိုးတိုးလှုပ် (panic မဖြစ်စေဘဲ သတိပေး)
- ★ ဒဏ်ရာရရင် ဘယ်ဘက်ကလာလဲ **ဦးတည်ချက်ပြ** (ဖန်သားပြင်အနားမှာ မင်စက်ထူထူ)

### (၃) WeaponStrip — ★ ကိန်းမဟုတ်ဘဲ ကျည်ပုံ

```
🔫 ▮▮▮▮▮▮▮▮▮▯▯▯   12/12     ← ★ ကျည်တစ်တောင့်ချင်း မြင်ရ
🗡 ∞     🏹 ▮▮▮▮▮▮   💣 ▮▮
```
★ ကျည်ကို ပုံနဲ့ပြတာက ကိန်းထက် **မြန်မြန်နားလည်** စေတယ် — ပစ်နေရင်း ဖတ်စရာမလို။
- ပြန်ဖြည့်နေချိန် — ★ ဝိုင်းပတ် progress + "ပြန်ဖြည့်နေသည်"
- ကုန်ရင် — strip က ဟင်္သပဒါးရောင် တစ်ချက်လင်း

### (၄) Crosshair — ★ ပစ်မှတ်ကို ပုံသဏ္ဌာန်နဲ့ခွဲ

```
ပုံမှန်          ✛        ကျောက်စိမ်း ဖျော့ဖျော့
ပစ်မှတ်ပေါ်ရောက်  ◎        ★ ဟင်္သပဒါး + ဝိုင်းကွင်း (ပုံသဏ္ဌာန်ကွာ)
ပစ်မှတ်မဟုတ်သူ   ⊗        ★ မီးခိုးရောင် + ကန့်လန့်  ← လူမှားသတ်တာ ကာကွယ်
ချိန်နေချိန်      ✛        ကျုံ့သွား
ထိလိုက်ရင်        ✕        ရွှေရောင် ဖျတ်ကနဲ (120ms)
ခေါင်းထိရင်       ✕        ★ ကြီးကြီး + အသံမြင့်
```

> ★ **⊗ (ပစ်မှတ်မဟုတ်သူ) က ဒီ game ရဲ့ အရေးအကြီးဆုံး UI element ပါ။**
> လူမှားသတ်ရင် အမှတ်လျော့တဲ့ game မှာ "ဒါ မင်းရဲ့ပစ်မှတ်မဟုတ်ဘူး" ဆိုတာ **ပစ်မိခင်** ပြောပေးရမယ်။ အရောင်တစ်ခုတည်းနဲ့မဟုတ်ဘဲ **ပုံသဏ္ဌာန်** နဲ့ခွဲထားလို့ အရောင်မခွဲနိုင်သူတွေလည်း သိရမယ်။

### (၅) KillFeed — မင်တံဆိပ်တုံး

```
┌──────────────────────────┐
│ ကိုမောင် ⟶ ခင်ခင်  ◎     │  ★ ရွှေ အနား = ပစ်မှတ်မှန်
├──────────────────────────┤
│ အောင်အောင် ⟶ မမ  ⊗      │  ★ မီးခိုး = လူမှား
└──────────────────────────┘
```
- ★ ကိုယ်ပါဝင်တဲ့ကြောင်းကိုသာ အလေးပေး (ကျန်တာ မှိန်)
- အများဆုံး ၄ ကြောင်း · ၄.၅s ပြီးရင် မှေးပျောက်

### (၆) Scoreboard — ကျောက်သင်ပုန်း

★ ဖုန်းမှာ **အောက်ကနေ ဆွဲတင်** (Tab ခလုတ်မရှိလို့)

```
┌─────────────────────────────────┐
│  ကျန်ချိန် 4:12                  │
│  ─────────────────────────────  │
│  ၁  ကိုမောင်မောင      ●●○  +2   │ ← ကိုယ့်တန်း ရွှေရောင်
│  ၂  ခင်ခင်ဦး          ●○○  +1   │
│  ၃  အောင်ကျော်        ○○○  -1   │ ← ★ အမှတ်အနုတ် ဟင်္သပဒါး
│  ─────────────────────────────  │
│  ★ ပစ်မှတ် ၃ ယောက် သတ်ပါ         │
└─────────────────────────────────┘
```
★ ကိန်း `2/3` အစား **●●○** — တစ်ချက်ကြည့်ရုံနဲ့ သိရတယ်။

### (၇) LobbyPanel — စောင့်ခန်း

```
┌─────────────────────────────────┐
│      ရင်ပြင်                     │  display font
│      ကစားသမား ၄ / ၁၂             │
│  ─────────────────────────────  │
│  ● ● ● ● ○ ○ ○ ○ ○ ○ ○ ○        │ ← ★ လူပြည့်မှုကို အစက်နဲ့ပြ
│                                  │
│  ၃ ယောက်ပြည့်ပါပြီ —              │
│  ၁၄ စက္ကန့်အတွင်း စတင်မည်          │
│                                  │
│  [ဇာတ်ကောင်ပြင်ရန်]  [ထွက်မည်]    │
└─────────────────────────────────┘
```
★ စောင့်ချိန်မှာ ★ ဇာတ်ကောင်ပြင်လို့ရ — စောင့်ရတာ ပျင်းစရာမဖြစ်စေဘူး။

### (၈) ResultPanel

```
┌─────────────────────────────────┐
│         🏆                       │
│      အနိုင်ရပါပြီ                 │  display, ရွှေ
│      ကိုမောင်မောင                 │
│  ─────────────────────────────  │
│  ပစ်မှတ်မှန်      ၃              │
│  လူမှား          ၀              │
│  ခေါင်းထိ        ၂              │
│  ─────────────────────────────  │
│  နောက်ပွဲ ၁၂ စက္ကန့်အတွင်း          │
│  [ဆက်ကစားမည်]   [မြို့သို့ပြန်]   │
└─────────────────────────────────┘
```

## 4.4 ★ Motion

| နေရာ | Animation | ကြာချိန် |
|---|---|---|
| ★ ကြေညာစာ ကျလာ | scale 1.4→1 + လှည့် -3°→0 | 420ms `cubic-bezier(.2,1.2,.3,1)` |
| ကြေညာစာ ထောင့်သို့ | position + scale | 320ms ease-in-out |
| ★ ဒဏ်ရာ မင်စက် | opacity + scale ဖြန့် | 180ms ဝင် / 900ms ထွက် |
| Hit marker | scale 0.6→1→0.85 | 120ms |
| ★ တံဆိပ်တုံးရိုက် | scale 2→1 + လှည့် | 260ms |
| Scoreboard ဆွဲတင် | translateY | 240ms |
| ကျည်လျော့ | ကျည်ပုံ တစ်တောင့် မှိန်သွား | 90ms |

```css
/* ★ မဖြစ်မနေ */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration:.01ms !important; transition-duration:.01ms !important; }
  /* ★ ဒါပေမယ့် ကြေညာစာက အချက်အလက် — ဖျောက်မပစ်ရ၊ ချက်ချင်းပြရုံ */
}
```

## 4.5 ★ စာသား (Copy)

| ❌ မလုပ်ရ | ✅ လုပ်ရမယ် | အကြောင်းရင်း |
|---|---|---|
| "Eliminated" | "ပစ်မှတ် ပြီးပါပြီ" | မြန်မာလို၊ ရိုးရှင်း |
| "You died" | "သေဆုံးသွားပါပြီ — ၄ စက္ကန့်" | ★ ဘာဆက်ဖြစ်မလဲ ပါရမယ် |
| "Wrong target!" | "ပစ်မှတ် မဟုတ်ပါ — အမှတ် ၁ လျော့" | ★ ဘာဖြစ်သွားလဲ တိတိကျကျ |
| "Waiting for players" | "ကစားသမား ၃ ယောက် လိုပါသေးသည်" | ★ ဘယ်လောက်လိုလဲ |
| "Connection lost" | "ချိတ်ဆက်မှု ပြတ်သွားပါပြီ — ပြန်ချိတ်နေသည်" | ★ လုပ်နေတာပါပြောရမယ် |
| "Reload" | "ကျည်ပြန်ဖြည့်ရန်" | လုပ်ဆောင်ချက် အမည် |

★ **တစ်သမတ်တည်းရှိရေး** — ခလုတ်မှာ "ဆက်ကစားမည်" ဆိုရင် ရလဒ်မှာလည်း "ဆက်ကစားနေသည်" ဖြစ်ရမယ်။

## 4.6 လက်တွေ့သုံးနိုင်မှု (Accessibility)

- [ ] ★ အရောင်တစ်ခုတည်းနဲ့ အဓိပ္ပာယ်မဖော်ပြရ — crosshair ◎ vs ⊗ က **ပုံသဏ္ဌာန်ကွာ**
- [ ] Killfeed မှာလည်း ◎/⊗ သင်္ကေတပါ
- [ ] Contrast ≥ 4.5:1 (ကိန်းဂဏန်းအားလုံး)
- [ ] ခလုတ် ≥ 48×48px
- [ ] ★ `prefers-reduced-motion` လိုက်နာ
- [ ] ★ HUD အရွယ် ချိန်ညှိလို့ရ (S/M/L) — ဖုန်းသေးသူအတွက်
- [ ] ★ ဘယ်/ညာ လက်မ ပြောင်းလို့ရ (ဘယ်သန်သူများ)
- [ ] Screen reader — match state ပြောင်းရင် `aria-live`

## 4.7 ❌ လုပ်မိတတ်သောအမှား ၈ ခု

1. ❌ Military sci-fi HUD (မီးစိမ်း၊ hexagon၊ scan line) → ★ metaverse နဲ့ မဆက်စပ်
2. ❌ ဖန်သားပြင်အလယ်မှာ notification ပြ → ★ မြင်ကွင်းပိတ်
3. ❌ ဒဏ်ရာကို အနီရောင် vignette → ★ မင်စက်နဲ့ ခွဲထားပြီးသား
4. ❌ ကျည်ကို ကိန်းချည်းပြ → ★ ပုံနဲ့ပြ
5. ❌ Killfeed ကို ကြောင်း ၈ ကြောင်း → ၄ ကြောင်းလုံလောက်
6. ❌ ပစ်မှတ်ကို နာမည်နဲ့ပဲပြ → ★ avatar ပုံနဲ့ပြ (ပိုမြန်)
7. ❌ ခလုတ်တွေ crosshair နားထား → ★ လက်နဲ့ဖုံးမယ်
8. ❌ Loading spinner ချည်း → ★ ဘယ်လောက်ကြာမလဲ ပြ

## 4.8 Acceptance Criteria

- [ ] ★ ကြေညာစာ animation အလုပ်လုပ် — avatar ပုံပါ
- [ ] ★ ပစ်မှတ်မဟုတ်သူပေါ် crosshair က ⊗ ပြောင်း
- [ ] ★ ဟင်္သပဒါးရောင်ကို ပစ်မှတ်/အန္တရာယ်အတွက်သာ (code review နဲ့စစ်)
- [ ] ကျည်ကို ပုံနဲ့ပြ
- [ ] iPhone SE (375×667) မှာ crosshair ပတ်လည် ၁၂၀px လွတ်
- [ ] နှိပ်စရာအားလုံး အောက် ၃၅% မှာ
- [ ] HUD အရွယ် ၃ မျိုး
- [ ] ★ ဘယ်/ညာ ပြောင်းလို့ရ
- [ ] စာသားအားလုံး မြန်မာလို၊ ဘာဆက်ဖြစ်မလဲပါ
- [ ] `prefers-reduced-motion` မှာ ကြေညာစာ ချက်ချင်းပြ (မဖျောက်)

---

# အပိုင်း ၅ — အသံ (Audio)

★ Shooter မှာ အသံက UI ရဲ့ တစ်ဝက်ပါ — မမြင်ရတာကို ကြားရတယ်။

| အသံ | ရည်ရွယ်ချက် | မှတ်ချက် |
|---|---|---|
| ပစ်သံ (လက်နက်အလိုက်) | ★ ဘယ်နားက ဘယ်လက်နက် | spatial |
| ★ ကျည်ဖြတ်သွားသံ | "ငါ့ကို ပစ်နေတယ်" | ★ အရေးအကြီးဆုံး |
| ခြေသံ | ★ နီးနေပြီ | 18m အတွင်း |
| ထိသံ | အတည်ပြုချက် | ခေါင်းထိ = မြင့်တဲ့သံ |
| ကျည်ပြန်ဖြည့်သံ | အခြေအနေ | |
| ★ ဗုံးမီးစာသံ | သတိပေး | 2.5s countdown |
| ပစ်မှတ်အသစ်သံ | တံဆိပ်တုံးသံ | ★ ကြေညာစာနဲ့တွဲ |

```ts
/* ★ Audio pool — buffer တစ်ခုတည်းကနေ source အများခု
   ပစ်တိုင်း decode လုပ်ရင် နှေးတယ် */
const audioPool = new Map<string, AudioBuffer>();
```
★ **Default volume 60%** · ★ အသံပိတ်ထားရင်လည်း ကစားလို့ရရမယ် (visual cue ပါရမယ်)

---

# အပိုင်း ၆ — Game Feel (Juice)

ဒါတွေက ရှိမှ "ကောင်းတယ်" လို့ခံစားရတယ် —

| အရာ | အသေးစိတ် |
|---|---|
| ★ ပစ်လိုက်ရင် camera တုန် | 0.04 unit · 80ms · ★ လက်နက်အလိုက်ကွာ |
| ★ ကျည်လမ်းကြောင်း | 0.12s မှိန်သွား · ရွှေရောင်ဖျော့ |
| ထိမှတ် particle | ၈ စက် · မျက်နှာပြင်အရောင်အလိုက် |
| ★ ခေါင်းထိရင် | ရွှေရောင် အလင်းတစ်ချက် + အသံမြင့် + ကိန်းကြီးကြီး |
| သေသွားရင် | ★ camera က အလောင်းကို ဖြေးဖြေးလှည့်ကြည့် |
| ★ ပစ်မှတ်နီးလာရင် | ဟင်္သပဒါး vignette **အလွန်မှိန်မှိန်** (တစ်ဝက်သတိထားမိရုံ) |
| ဗုံးပေါက်ကွဲ | screen shake + အလင်းတိုး + အသံ |

> ★ **"ပစ်မှတ်နီးလာရင် vignette" က ဒီ game ရဲ့ တင်းမာမှုကို ဖန်တီးတဲ့ အရာပါ** — ဒါပေမယ့် သိသိသာသာဖြစ်ရင် ရိုးရိုးရှာစရာမလိုတော့ဘူး။ ၁၅ unit ကနေ စပြီး opacity 0.08 ထက်မကျော်ရ။

---

# အပိုင်း ၇ — အလုပ်ချိန်နှင့် အစဉ်

| အဆင့် | အလုပ် | ခန့်မှန်း |
|---|---|---|
| **၁** | Room type + Lobby + Snapshot netcode | 6 ရက် |
| **၂** | Arena map + zone culling | 5 ရက် |
| **၃** | ★ ဝှက်တမ်း mode (combat မလို) | 4 ရက် |
| **၄** | Rendering tech (instancing/KTX2/LOD/adaptive) | 6 ရက် |
| **၅** | UI design system အပြည့် | 7 ရက် |
| **၆** | Projectile combat + hitbox + anti-cheat | 8 ရက် |
| **၇** | Assassin mode (ပစ်မှတ်သံသရာ) | 4 ရက် |
| **၈** | Avatar/gear + entitlement | 4 ရက် |
| **၉** | Persistence + leaderboard | 3 ရက် |
| **၁၀** | အသံ + game feel + ညှိ | 5 ရက် |

**စုစုပေါင်း ~52 ရက်**

★ **အဆင့် ၃ (ဝှက်တမ်း) ပြီးရင် တစ်ခါထုတ်ပါ** — ၁၅ ရက်နဲ့ ကစားလို့ရတဲ့အရာ ရပြီ။ ကစားသမားတုံ့ပြန်မှုကြည့်ပြီးမှ Assassin ဆက်လုပ်တာက အန္တရာယ်နည်းတယ်။

---

**စာရွက်စာတမ်းဗားရှင်း** — Arena Design & Tech v1.0
**ရေးသားသည့်ရက်** — 2026-08-03
**ဆက်စပ်ဖိုင်** — `GWAVE_ASSASSIN_INTEGRATION.md` · `GWAVE_METAVERSE_BUILD.md`
