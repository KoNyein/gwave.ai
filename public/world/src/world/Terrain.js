// ============================================================
// Terrain.js — အခန်းတွေရဲ့ ပတ်ဝန်းကျင်ကို **ပြေပြင်အစစ်** ဖြစ်အောင်
//              တောင်ကုန်း၊ တောင်တန်းများ ထည့်ပေးသည်
//
// user: "metaverse rooms တွေမှာ virtual world ထဲမှာ environment ကို
//        ပြေပြင်အစစ် တောင်ကုန်း တောင်တန်း ထည့်ပါ"
//
// အရင်က အခန်းတိုင်းက **ပြားနေတဲ့ စတုရန်း** တစ်ချပ်ပဲ — အစွန်းရောက်ရင်
// ဘာမှ မရှိတဲ့ ဟင်းလင်းပြင် ဖြစ်နေတယ်။ လောကက အဆုံးသတ်နေတယ်လို့
// ချက်ချင်း သိသာတယ်။
//
// ═══ ဒီစနစ်က ဘယ်လို အလုပ်လုပ်လဲ ═══
//
// ★ **အလယ်က ပြားနေတာ မပြောင်းဘူး** — ဒါ အရေးအကြီးဆုံး。
//   အမြင့်ကို ဗဟိုကနေ အကွာအဝေး အလိုက် mask နဲ့ မြှောက်တယ်၊ `flatRadius`
//   အတွင်းမှာ mask = 0 ဖြစ်လို့ ကစားကွင်း **လုံးဝ ပြားနေတယ်**。 ဒါကြောင့်
//   collider တွေ၊ လမ်းလျှောက်တာ၊ ပစ်ခတ်တာ ဘာမှ မထိခိုက်ဘူး — ရှိပြီးသား
//   physics က AABB box တွေချည်းပဲ ဖြစ်လို့ heightfield collision ထည့်စရာ
//   မလိုဘူး (အဲဒါက အခန်းတိုင်း ပြန်စမ်းရမယ့် အန္တရာယ်ကြီးတဲ့ အလုပ်)。
//
// ★ **တောင်ကုန်း → တောင်တန်း** — အနီးမှာ လှိုင်းလိုက် ကုန်းလေးတွေ (fbm)၊
//   အဝေးရောက်လေ ridge noise က ထောင်လာလေ (`1 - |2n-1|` က ချွန်တဲ့
//   တောင်ထွတ်ကို ပေးတယ် — fbm ချည်းက ဒိန်ခဲလို ပြေပြေလေးပဲ ဖြစ်တယ်)。
//
// ★ **ဖိုင် သုည** — texture မဆွဲဘူး၊ heightmap ပုံ မသုံးဘူး။ noise ကို
//   ကိုယ်တိုင် တွက်ပြီး vertex colour နဲ့ မြက်/ကျောက်/နှင်း ခွဲတယ်။
//   ဖုန်းမှာ download တစ်ခုမှ မတိုးဘူး。
//
// 🔋 ဖုန်း — mesh **တစ်ခုတည်း** (draw call တစ်ခု)၊ frame တိုင်း update
//   မလုပ်ဘူး၊ အရိပ် မချဘူး၊ touch စက်မှာ segment ၆၄ (တြိဂံ ~၈,၂၀၀)。
// ============================================================

import * as THREE from 'three';

/// ─────────── noise (deterministic, seed အလိုက် တူညီတဲ့ ရလဒ်) ───────────

/// integer hash → [0,1)。 sin ကို မသုံးဘူး — စက်တစ်ခုနဲ့တစ်ခု sin ရဲ့
/// နောက်ဆုံး ဂဏန်းတွေ ကွာတတ်လို့ တောင်ပုံစံ ပြောင်းသွားနိုင်တယ်။
function hash2(ix, iz, seed) {
  let h = (ix | 0) * 374761393 + (iz | 0) * 668265263 + (seed | 0) * 1442695040;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/// value noise — grid ထောင့် ၄ ခုကို smoothstep နဲ့ ရော
function noise2(x, z, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = smooth(x - x0), fz = smooth(z - z0);
  const a = hash2(x0, z0, seed),     b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed), d = hash2(x0 + 1, z0 + 1, seed);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

/// fbm — octave တွေ ထပ်ပြီး အကြမ်းအနုတ် နှစ်မျိုးလုံး ရအောင်
function fbm(x, z, seed, octaves = 4) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += noise2(x * f, z * f, seed + i * 131) * amp;
    norm += amp;
    amp *= 0.5; f *= 2.03;   // 2.03 — အတိအကျ ၂ ဆိုရင် ပုံစံ ထပ်တတ်တယ်
  }
  return v / norm;
}

/// ridge — တောင်ထွတ် ချွန်အောင်။ `1 - |2n-1|` က ချိုင့်ကို ထွတ် ပြောင်းတယ်
function ridged(x, z, seed, octaves = 3) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise2(x * f, z * f, seed + i * 977);
    v += (1 - Math.abs(2 * n - 1)) * amp;
    norm += amp;
    amp *= 0.5; f *= 2.11;
  }
  return v / norm;
}

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const step01 = (a, b, t) => (b === a ? (t < a ? 0 : 1) : smooth(clamp01((t - a) / (b - a))));
const mix = (a, b, t) => a + (b - a) * t;

/// ─────────── ရာသီဥတု/ဒေသ အလိုက် အရောင် ───────────
///
/// အမြင့် အလိုက် အရောင် ခွဲတယ် — မြက် → တောစိမ်း → ကျောက် → နှင်း。
/// band တစ်ခုနဲ့တစ်ခု smoothstep နဲ့ ရောလို့ အနားသတ် မပေါ်ဘူး။
const PALETTES = {
  /// မြန်မာ တောင်တန်း — စိမ်းစိုပြီး ထိပ်မှာ နှင်း
  green: {
    low: 0x4c6b34, mid: 0x3d5c2c, rock: 0x6c675e, snow: 0xe6edf5,
    midAt: 10, rockAt: 34, snowAt: 62, shade: 0.48,
  },
  /// လယ်ယာ ချိုင့်ဝှမ်း — ပိုစိမ်း၊ တောင် နိမ့်၊ နှင်း မပါ
  lush: {
    low: 0x5a7c3a, mid: 0x466a2c, rock: 0x6f6a56, snow: 0x9aa08c,
    midAt: 8, rockAt: 30, snowAt: 70, shade: 0.52,
  },
  /// ခြောက်သွေ့ ကျောက်တောင် — STRIKE Arena ပတ်ဝန်းကျင်
  arid: {
    low: 0x7a6a4a, mid: 0x6a5a3e, rock: 0x6b6560, snow: 0x8d8a84,
    midAt: 8, rockAt: 26, snowAt: 66, shade: 0.68,
  },
  /// ည — အရောင် မှိန်ပြီး အပြာဆွမ်း
  night: {
    low: 0x2a3a2e, mid: 0x24302c, rock: 0x3a3d46, snow: 0x8f9ab0,
    midAt: 10, rockAt: 32, snowAt: 60, shade: 0.9,
  },
};

/// hex → sRGB channel (0..1)。 vertex ထောင်ချီ ရှိလို့ THREE.Color object
/// မဆောက်ဘူး — build ချိန်မှာ အမှိုက် ထောင်ချီ ထုတ်စရာ မလိုဘူး။
const R = (hex) => ((hex >> 16) & 255) / 255;
const G = (hex) => ((hex >> 8) & 255) / 255;
const B = (hex) => (hex & 255) / 255;

/// အမြင့် အလိုက် အရောင် — မြက် → တောစိမ်း → ကျောက် → နှင်း
/// `out` ကို ပြန်သုံးတယ် (allocation မရှိ)
function bandColour(p, h, jitter, out) {
  const tMid = step01(0, p.midAt, h);
  const tRock = step01(p.midAt, p.rockAt, h);
  const tSnow = step01(p.rockAt, p.snowAt, h);
  let r = mix(R(p.low), R(p.mid), tMid);
  let g = mix(G(p.low), G(p.mid), tMid);
  let b = mix(B(p.low), B(p.mid), tMid);
  r = mix(r, R(p.rock), tRock); g = mix(g, G(p.rock), tRock); b = mix(b, B(p.rock), tRock);
  r = mix(r, R(p.snow), tSnow); g = mix(g, G(p.snow), tSnow); b = mix(b, B(p.snow), tSnow);
  // ★ vertex တစ်ခုချင်း အနည်းငယ် ကွဲစေတယ် — မကွဲရင် ပလပ်စတစ်လို ချောနေတယ်
  const j = 1 + (jitter - 0.5) * 0.14;
  out[0] = clamp01(r * j); out[1] = clamp01(g * j); out[2] = clamp01(b * j);
}

/// ─────────── အဓိက function ───────────

/**
 * အခန်းတစ်ခုရဲ့ ပတ်ဝန်းကျင်မှာ တောင်ကုန်း/တောင်တန်း ထည့်ပေးတယ်။
 *
 * @param {Room} room        — Room instance (group, colliders, fog ကို ထိတယ်)
 * @param {object} o
 *   o.ground   — အခန်းရဲ့ ပြားနေတဲ့ ကြမ်းပြင် စတုရန်း အရွယ် (ဥပမာ ၁၄၀)
 *   o.palette  — 'green' | 'lush' | 'arid' | 'night'
 *   o.seed     — အခန်းတစ်ခုချင်း မတူတဲ့ တောင်ပုံစံ (ပုံသေ — အမြဲ တူညီတယ်)
 *   o.peak     — အမြင့်ဆုံး တောင်ထွတ် (မီတာ၊ default ၉၅)
 *   o.hill     — အနီးက ကုန်းလေးတွေရဲ့ အမြင့် (default ၁၄)
 *   o.wall     — ကစားကွင်း အစွန်းမှာ မမြင်ရတဲ့ နံရံ ထားမလား (default true)
 */
export function addTerrain(room, {
  ground = 140,
  palette = 'green',
  seed = 1,
  peak = 95,
  hill = 14,
  wall = true,
  /// 🗺️ terrain mesh ရဲ့ အနံ — မြို့ ကြီးလာရင် တောင်တန်းကို ပြင်ပ ဆီ
  /// တွန်းထုတ်ရမယ်၊ မဟုတ်ရင် မြို့က တောင်ကို ကျော်ထွက်သွားမယ်။
  /// ★ camera far နဲ့ တွဲတယ် — Engine က ၁၂၅၀ ထားတယ်၊ ဒါထက် ကြီးရင်
  ///   ဖြတ်တောက်ခံရမယ်။
  extent = 760,
  /// 🛕 ပြားနေရမယ့် နေရာ ထပ်ဆောင်း — [{x, z, r}]。 တောင်တန်း အလယ်မှာ
  /// အဆောက်အအုံကြီး ချထားရင် တောင်က အထဲကနေ ထိုးထွက်လာမယ်၊ ဒါကို
  /// ဖြေရှင်းဖို့ အဲဒီနေရာကို ပြားအောင် လုပ်ပေးတယ်။
  flatSpots = [],
} = {}) {
  const mobile = matchMedia('(hover: none), (max-width: 820px)').matches;
  const SIZE = extent;              // camera far အတွင်း ဝင်ရမယ် (Engine: ၁၂၅၀)
  const SEG = mobile ? 64 : 112;
  const P = PALETTES[palette] || PALETTES.green;

  // ★ ပြားရမယ့် အချင်းဝက် — စတုရန်း ကြမ်းပြင်ရဲ့ **ထောင့်** အထိ ဖုံးရမယ်
  //   (ထောင့်က အလယ်ကနေ အနားထက် √2 ဆ ဝေးတယ်)。 မဟုတ်ရင် ကြမ်းပြင်
  //   ထောင့်လေးနေရာမှာ တောင်က ထိုးထွက်လာမယ်။
  const flatR = ground * 0.71 + 6;
  const blend = 70;                 // ပြားရာကနေ ကုန်းဖြစ်လာတဲ့ အကူးအပြောင်း
  const rimR = SIZE * 0.5;

  // ★ **အမြင့်ကို function တစ်ခုတည်းက တွက်တယ်** — mesh ဆောက်တာရော
  //   physics ရော ဒီတစ်ခုတည်းကို သုံးတယ်။ နှစ်နေရာ သီးသန့် ရေးရင်
  //   တစ်နေရာ ပြင်လိုက်တိုင်း မြေနဲ့ ခြေထောက် ကွဲသွားမယ်။
  const heightAt = (x, z) => {
    const d = Math.hypot(x, z);
    const mask = step01(flatR, flatR + blend, d);        // အလယ် = ၀
    // ★ ဝေးလေ ထောင်လေ — ဒါပေမယ့် **မြန်မြန်**。 rim (၃၅၀m) အထိ ဖြန့်ရင်
    //   တောင်တန်းက မြူထဲ ရောက်သွားပြီး မမြင်ရတော့ဘူး။ ကစားကွင်း အနားကနေ
    //   ၁၄၀m အတွင်း အမြင့်ဆုံး ရောက်စေတယ် — ချိုင့်ဝှမ်းထဲ ရောက်နေသလို။
    const far = step01(flatR + blend * 0.4, flatR + blend + 140, d);
    const hills = fbm(x * 0.0065, z * 0.0065, seed, 4);
    const crest = ridged(x * 0.0026, z * 0.0026, seed + 61, 3);
    let h = mask * (hills * hill + Math.pow(far, 1.25) * Math.pow(crest, 1.5) * peak);
    // 🛕 ပြားနေရမယ့် နေရာများ — အလယ်မှာ ၀, အနားမှာ ဖြည်းဖြည်း ပြန်တက်
    for (const sp of flatSpots) {
      h *= step01(sp.r, sp.r + (sp.blend ?? 60), Math.hypot(x - sp.x, z - sp.z));
    }
    return h;
  };
  room.terrainHeight = heightAt;

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const rgb = [0, 0, 0];

  for (let i = 0; i < pos.count; i++) {
    // PlaneGeometry က XY ပေါ်မှာ — rotateX(-90°) လုပ်တော့ y → z ဖြစ်တယ်
    const x = pos.getX(i);
    const z = pos.getY(i);
    const h = heightAt(x, z);

    pos.setZ(i, h);   // rotateX မလုပ်ခင် — Z က အမြင့်

    bandColour(P, h, hash2(Math.round(x), Math.round(z), seed + 3), rgb);
    colours[i * 3] = rgb[0];
    colours[i * 3 + 1] = rgb[1];
    colours[i * 3 + 2] = rgb[2];
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    // ★ flatShading — segment နည်းတဲ့ mesh မှာ ဒါက အားနည်းချက်ကို
    //   ပုံစံ ဖြစ်အောင် ပြောင်းပေးတယ် (low-poly တောင်တန်း)。
    flatShading: true,
  }));
  // ★ အလင်း အားကောင်းလွန်းလို့ vertex အရောင်တွေ ဖွေးသွားတယ် — material
  //   အရောင်က vertex colour ကို မြှောက်တာမို့ ဒီမှာ ချရတယ်။
  //   တိုင်းတာချက်: မချခင် မဲဆောက်မှာ ကောင်းကင် rgb(171,166,217) နဲ့
  //   တောင်တန်း rgb(180,166,211) — ကွာခြားချက် ~၉ ပဲ ရှိလို့ တောင်က
  //   လုံးဝ မမြင်ရဘူး။ နေ့ခင်း အခန်းတွေမှာ ပိုချရတယ် (အဝေးက တောင်ဟာ
  //   တောက်ပတဲ့ ကောင်းကင်ရှေ့မှာ **အမှောင်** အရိပ်အဖြစ်သာ မြင်ရတယ်)。
  mesh.material.color.setScalar(P.shade ?? 0.7);
  // ★ ၂ စင်တီ နိမ့်ထားတယ် — အခန်းရဲ့ ကြမ်းပြင်နဲ့ z-fight မဖြစ်အောင်၊
  //   ဒါပေမယ့် လူ့အမြင်မှာ လုံးဝ မသိသာဘူး။
  mesh.position.y = -0.02;
  mesh.receiveShadow = false;   // 🔋 ဖုန်း — အရိပ် မလို
  mesh.castShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.renderOrder = -1;        // ကြမ်းပြင်တွေရဲ့ အရင် ဆွဲ
  room.group.add(mesh);

  // ── မမြင်ရတဲ့ နံရံ — လောကရဲ့ **အစွန်း**မှာ ────────────────────────
  //
  // ★ အရင်က နံရံက ကစားကွင်း အနား (ground/2) မှာ ရှိတယ် — တောင်တန်းတွေက
  //   အပြင်မှာ ဖြစ်လို့ **ဘယ်တော့မှ မရောက်နိုင်ဘူး**။ ကြည့်ဖို့ပဲ ရှိတာ။
  //   user: "တောင်တန်းများပေါ် တက်တတ်ရအောင်"。
  //   အခု နံရံကို terrain mesh ရဲ့ အစွန်းအထိ တွန်းထုတ်လိုက်တယ် — မြို့ကနေ
  //   ထွက်ပြီး ကုန်းတွေ တောင်တွေ ပေါ် တက်လို့ ရပြီ။ ကစားကွင်း အလယ်က
  //   ပြားနေတာ မပြောင်းဘူး (mask က အဲဒီမှာ ၀)。
  if (wall) {
    const e = rimR - 6;           // terrain အစွန်းနဲ့ ၆ m ခွာ
    const t = 6;
    const H = 200;                // တောင်ထက် မြင့်ရမယ်
    const W = e + t;
    const boxes = [
      [-W, -e - t, W, -e],        // မြောက်
      [-W, e, W, e + t],          // တောင်
      [-e - t, -W, -e, W],        // အနောက်
      [e, -W, e + t, W],          // အရှေ့
    ];
    for (const [x0, z0, x1, z1] of boxes) {
      room.colliders.push(new THREE.Box3(
        new THREE.Vector3(x0, 0, z0),
        new THREE.Vector3(x1, H, z1),
      ));
    }
  }

  // ── မြူ — တောင်တန်းတွေ မြင်ရအောင် အကွာအဝေး ဆွဲထုတ် ────────────
  //
  // မူလ မြူက ၅၅→၁၉၀ 。 တောင်တွေက ၂၀၀–၃၈၀ မှာ ရှိလို့ အဲဒီ setting နဲ့ဆို
  // နောက်ခံအရောင် တစ်ခုတည်း ဖြစ်ပြီး လုံးဝ မမြင်ရဘူး။
  if (room.fogNear == null) room.fogNear = 220;
  if (room.fogFar == null) room.fogFar = 800;

  return mesh;
}
