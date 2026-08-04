import type { MapDef, ModelDef } from "./types";

/// 🌆 Gwave City — Kenney CC0 3D kit တွေနဲ့ ဆောက်ထားတဲ့ showcase world။
///
/// ★ Model အရွယ်တွေက **တိုင်းထားတဲ့ manifest** ကနေ လာတယ် (glb ဖိုင်တိုင်းကို
///   gltf-transform နဲ့ scan) — လက်နဲ့မှန်းရေးရင် အဆောက်အအုံတွေ အရွယ်လွဲပြီး
///   မြို့က ရုပ်ဆိုးတယ် (KENNEY_KIT_GUIDE.md ရဲ့ စည်းမျဉ်း)။
/// ★ မြို့ကွက် — မြောက်ဘက် စီးပွားရေးလမ်း ၂ တန်း + skyline၊ အနောက်တောင်
///   စက်မှုဇုန်၊ အရှေ့ ဈေးရပ်ကွက် (fantasy)၊ ဗဟို ပန်းခြံရင်ပြင်မှာ
///   ရုပ်တုတန်း။ Kenney kit ရဲ့ modular သဘောအတိုင်း အနံတွေကို
///   စီတန်းချထားတယ် (shelf packing) — model ကို ဆွဲမဆန့်ဘူး။

const KIT = "/metaverse/kits";
/// အဆောက်အအုံ scale — Kenney ရဲ့ ~1 unit အဆောက်အအုံကို လူသားအရွယ် (8m) ဖြစ်အောင်
const S = 8;

type Spec = { id: string; w: number; d: number };

/// ★ manifest ကနေ ကူးထားတဲ့ width/depth (model unit) — collider နဲ့
///   စီတန်းချရာမှာ သုံးတယ်။
const COMMERCIAL_ROW_A: Spec[] = [
  { id: "building-a", w: 0.9, d: 0.9 },
  { id: "building-b", w: 1.0, d: 0.9 },
  { id: "building-c", w: 0.9, d: 1.1 },
  { id: "building-d", w: 0.8, d: 0.9 },
  { id: "building-e", w: 1.6, d: 1.0 },
  { id: "building-f", w: 0.8, d: 1.0 },
  { id: "building-g", w: 1.0, d: 0.9 },
];
const COMMERCIAL_ROW_B: Spec[] = [
  { id: "building-h", w: 0.9, d: 1.0 },
  { id: "building-i", w: 1.2, d: 1.3 },
  { id: "building-j", w: 2.1, d: 1.3 },
  { id: "building-k", w: 2.1, d: 0.9 },
  { id: "building-l", w: 1.4, d: 1.4 },
  { id: "building-m", w: 1.2, d: 1.2 },
  { id: "building-n", w: 2.3, d: 1.8 },
];
const SKYSCRAPERS: Spec[] = [
  { id: "building-skyscraper-a", w: 1.4, d: 1.4 },
  { id: "building-skyscraper-b", w: 1.4, d: 1.4 },
  { id: "building-skyscraper-c", w: 1.3, d: 1.4 },
  { id: "building-skyscraper-d", w: 1.3, d: 1.4 },
  { id: "building-skyscraper-e", w: 1.3, d: 1.2 },
];

/// လမ်းတစ်တန်းအတိုင်း စီတန်းချ — model တစ်ခုချင်း ကိုယ့်အနံအလိုက် နေရာယူတယ်။
function row(
  pack: string,
  specs: Spec[],
  startX: number,
  z: number,
  ry: number,
  gap: number,
): ModelDef[] {
  const out: ModelDef[] = [];
  let x = startX;
  for (const s of specs) {
    const half = (s.w * S) / 2;
    x += half;
    out.push({
      url: `${KIT}/${pack}/${s.id}.glb`,
      x: Math.round(x * 10) / 10,
      z,
      ry,
      scale: S,
      collide: { w: s.w, d: s.d },
    });
    x += half + gap;
  }
  return out;
}

const m = (
  pack: string,
  id: string,
  x: number,
  z: number,
  over: Partial<ModelDef> = {},
): ModelDef => ({ url: `${KIT}/${pack}/${id}.glb`, x, z, ...over });

/// ဗဟိုရင်ပြင် ရုပ်တုတန်း — Blocky character ၁၀ ယောက် စက်ဝိုင်းပုံ။
/// (bind-pose mesh က ~၉ unit မြင့်လို့ scale 0.2 = လူအရွယ်; y:1 က
/// မြေအောက် ၁ unit စူးနေတာကို ပြန်တင်တာ)
const STATUES: ModelDef[] = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  const r = 9;
  return {
    url: `${KIT}/characters/character-${"abcdefghij"[i]}.glb`,
    x: Math.round(Math.cos(a) * r * 10) / 10,
    z: Math.round(Math.sin(a) * r * 10) / 10,
    ry: Math.atan2(-Math.cos(a), -Math.sin(a)),
    scale: 0.2,
    y: 1,
  };
});

/// ဈေးရပ်ကွက် — ရေပန်းပတ်လည် ဈေးဆိုင်စင်တွေ
const MARKET: ModelDef[] = [
  m("fantasy", "fountain-round", 58, 48, { scale: 5, collide: { w: 2, d: 2 } }),
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    return m("fantasy", i % 2 ? "stall-green" : "stall-red",
      Math.round((58 + Math.cos(a) * 15) * 10) / 10,
      Math.round((48 + Math.sin(a) * 15) * 10) / 10,
      { ry: Math.atan2(58 - (58 + Math.cos(a) * 15), 48 - (48 + Math.sin(a) * 15)), scale: 4, collide: { w: 1, d: 1 } });
  }),
  m("fantasy", "cart", 40, 32, { ry: 0.6, scale: 4 }),
  m("fantasy", "cart-high", 76, 62, { ry: -1.1, scale: 4 }),
  m("fantasy", "stall-bench", 50, 60, { scale: 4 }),
  m("fantasy", "windmill", 88, 74, { scale: 6, collide: { w: 0.8, d: 0.8 } }),
  m("fantasy", "watermill", 30, 80, { scale: 6, y: 0.9, collide: { w: 0.85, d: 1.8 } }),
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return m("fantasy", "lantern",
      Math.round((58 + Math.cos(a) * 22) * 10) / 10,
      Math.round((48 + Math.sin(a) * 22) * 10) / 10, { scale: 4 });
  }),
  m("fantasy", "tree-high", 34, 44, { scale: 5 }),
  m("fantasy", "tree", 44, 70, { scale: 5 }),
  m("fantasy", "tree-high", 72, 28, { scale: 5 }),
  m("fantasy", "tree", 86, 44, { scale: 5 }),
  m("fantasy", "rock-large", 26, 58, { scale: 4 }),
];

/// စက်မှုဇုန် — ဂိုဒေါင်/စက်ရုံ တန်းများ + ခေါင်းတိုင်တွေ
const INDUSTRIAL: ModelDef[] = [
  ...row("industrial", [
    { id: "building-a", w: 2.1, d: 1.2 },
    { id: "building-b", w: 2.1, d: 1.3 },
    { id: "building-e", w: 1.7, d: 1.3 },
  ], -96, 38, 0, 5),
  ...row("industrial", [
    { id: "building-f", w: 1.8, d: 1.3 },
    { id: "building-l", w: 2.1, d: 1.9 },
    { id: "building-r", w: 2.5, d: 1.3 },
  ], -98, 66, 0, 5),
  m("industrial", "chimney-large", -30, 42, { scale: S, collide: { w: 1, d: 1 } }),
  m("industrial", "chimney-medium", -44, 66, { scale: S, collide: { w: 0.5, d: 0.5 } }),
  m("industrial", "detail-tank", -28, 56, { scale: S, collide: { w: 0.8, d: 0.5 } }),
  m("industrial", "detail-tank", -22, 62, { scale: S, collide: { w: 0.8, d: 0.5 } }),
];

export const GWAVE_CITY: MapDef = {
  id: "gwave-city",
  name: "Gwave City",
  emoji: "🌆",
  blurb:
    "Kenney 3D kit တွေနဲ့ ဆောက်ထားတဲ့ မြို့သစ် — skyline, ဈေးရပ်ကွက်, စက်မှုဇုန်, ရုပ်တုရင်ပြင်",
  spawn: { x: 0, y: 0, z: 22, ry: Math.PI },
  worldRadius: 120,
  walkRadius: 114,
  palette: {
    // ညနေခင်း မြို့ပြ — ကတ္တရာလမ်း + နွေးတဲ့ မီးရောင်တွေနဲ့ လိုက်ဖက်အောင်
    ground: 0x2e3138,
    grid: 0x3c404a,
    skyDay: 0x7fb2e5,
    skyDusk: 0xe08a5a,
    skyNight: 0x161a26,
    fogDay: 0x9cbdd9,
    fogNight: 0x11141d,
    fogNear: 40,
    fogFar: 170,
  },
  terrain: { kind: "flat" },
  // Engine primitive buildings မသုံးဘူး — model တွေက မြို့။
  buildings: [],
  water: [
    // Watermill ဘေးက ချောင်းကန်လေး
    { kind: "pool", x: 30, z: 88, radius: 7, level: 0.06, color: 0x3f7fae, opacity: 0.75 },
  ],
  fires: [
    { x: 6, z: -14, scale: 0.9 },
    { x: -6, z: -14, scale: 0.9 },
  ],
  trees: [
    { x: -60, z: -20, kind: "broadleaf", scale: 1.3 },
    { x: -74, z: -6, kind: "broadleaf", scale: 1.2 },
    { x: 62, z: -18, kind: "pine", scale: 1.2 },
    { x: 78, z: -4, kind: "broadleaf", scale: 1.4 },
    { x: -20, z: 90, kind: "pine", scale: 1.2 },
    { x: 8, z: 96, kind: "broadleaf", scale: 1.3 },
  ],
  lamps: [
    { x: 14, z: 0, color: 0xffd9a0 },
    { x: -14, z: 0, color: 0xffd9a0 },
    { x: 0, z: 14, color: 0xffd9a0 },
    { x: 30, z: -20, color: 0xffd9a0 },
    { x: -30, z: -20, color: 0xffd9a0 },
    { x: 0, z: -58, color: 0xffd9a0 },
    { x: -60, z: 52, color: 0xffd9a0 },
    { x: 58, z: 48, color: 0xffd9a0 },
  ],
  vehicles: [
    { kind: "car", x: 22, z: -12, ry: Math.PI / 2 },
    { kind: "car", x: -26, z: -60, ry: 0 },
    { kind: "drone", x: 12, z: 30, ry: 0 },
  ],
  models: [
    // ── မြောက်ဘက် စီးပွားရေးလမ်း ၂ တန်း (မျက်နှာချင်းဆိုင်) ──
    ...row("commercial", COMMERCIAL_ROW_A, -38, -26, Math.PI, 3),
    ...row("commercial", COMMERCIAL_ROW_B, -52, -48, 0, 3),
    // ── Skyline — နောက်ခံ မိုးမျှော်တိုက်တန်း ──
    ...row("commercial", SKYSCRAPERS, -52, -72, 0, 9),
    // ── စက်မှုဇုန် (အနောက်တောင်) ──
    ...INDUSTRIAL,
    // ── ဈေးရပ်ကွက် (အရှေ့) ──
    ...MARKET,
    // ── ဗဟိုရင်ပြင် ရုပ်တုတန်း ──
    ...STATUES,
  ],
  weather: { default: "clear", allowed: ["clear", "rain", "fog"] },
  ambientSound: "city",
  gwaveLink: { kind: "live", x: 0, z: -12 },
};
