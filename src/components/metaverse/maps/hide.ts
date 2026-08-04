import type { MapDef } from "./types";

/// 🙈 ဝှက်တမ်း — hub world ထဲက **game room** (hide-and-seek, အသက်မရွေး)。
///
/// ★ Room id `hide-1` (server: type game, gameMode hide, gate မရှိ)。
///   Assassin ပွဲကွင်းနဲ့ ဆန့်ကျင်ဘက် — ဒီမှာ လက်နက်/ထိခိုက်မှု လုံးဝ မရှိ၊
///   server ကလည်း combat message တွေကို ဒီ room မှာ လက်မခံဘူး (mode က
///   usesCombat:false)。
/// ★ ပုန်းစရာ များများ — ဝှက်တမ်းရဲ့ ပျော်စရာက ပုန်းစရာနေရာ။ ခြံစည်းရိုး
///   (hedge) များ၊ သစ်ပင်စုများ၊ တဲကလေးများ — မြေပြင်မှာ ဘယ်နေရာကနေမဆို
///   ၅ လှမ်းအတွင်း ပုန်းစရာ ရှိအောင် စီထားတယ်။
/// ★ walkRadius 30 — game room တွေရဲ့ စံဘောင် (arena နဲ့ တူညီ)。

const hedge = (x: number, z: number, horizontal: boolean, len = 6): MapDef["buildings"][number] => ({
  x,
  z,
  w: horizontal ? len : 1,
  h: 1.9, // ခေါင်းစွန်းလေး မြင်ရလောက်တဲ့ အမြင့် — ရှာရတာ ပျော်စရာဖြစ်အောင်
  d: horizontal ? 1 : len,
  color: 0x2f6d3a,
  roof: "flat",
});

const hut = (x: number, z: number, color: number): MapDef["buildings"][number] => ({
  x,
  z,
  w: 3,
  h: 2.4,
  d: 3,
  color,
  roof: "gable",
  roofColor: 0x8a4b32,
});

export const HIDE_MAP: MapDef = {
  id: "hide-1",
  name: "ဝှက်တမ်းဥယျာဉ်",
  emoji: "🙈",
  blurb:
    "ရှာဖွေသူ ၁ ယောက် — ကျန်တာ ပုန်း။ လက်နက်မပါ၊ အသက်မရွေး ကစားလို့ရတယ်",
  spawn: { x: 0, y: 0, z: 24, ry: Math.PI },
  worldRadius: 36,
  walkRadius: 30,
  palette: {
    // နေဝင်ချိန် ဥယျာဉ် — နွေးထွေးပြီး ပျော်စရာ
    ground: 0x2e5d33,
    grid: 0x3c7245,
    skyDay: 0x87b7e8,
    skyDusk: 0xe8a06b,
    skyNight: 0x1d2438,
    fogDay: 0x9cc4e0,
    fogNight: 0x131a28,
    fogNear: 28,
    fogFar: 110,
  },
  terrain: { kind: "flat" },
  buildings: [
    // ဗဟို ပန်းခြံစင်္ကြံ — ရှာဖွေသူရဲ့ စမှတ်
    { x: 0, z: 0, w: 3.4, h: 3.2, d: 3.4, color: 0xc8b08a, roof: "dome", roofColor: 0x7a5c3e, label: "စမှတ်" },
    // Hedge ဝင်္ကပါ လမ်းကြောင်း — အတွင်းကွင်း
    hedge(7, 4, true),
    hedge(-7, -4, true),
    hedge(4, -8, false),
    hedge(-4, 8, false),
    hedge(11, -3, false, 5),
    hedge(-11, 3, false, 5),
    // အလယ်ကွင်း hedge L များ
    hedge(15, 10, true, 7),
    hedge(-15, -10, true, 7),
    hedge(10, 16, false, 5),
    hedge(-10, -16, false, 5),
    // တဲကလေး ၄ လုံး — ထောင့်တစ်ခုစီမှာ ပုန်းခန်း
    hut(21, 21, 0xd9c38a),
    hut(-21, 21, 0xa8c686),
    hut(21, -21, 0x9db8d2),
    hut(-21, -21, 0xd2a8a8),
    // အပြင်ကွင်း hedge တိုများ
    hedge(24, 6, false, 5),
    hedge(-24, -6, false, 5),
    hedge(6, 25, true, 5),
    hedge(-6, -25, true, 5),
  ],
  water: [
    // ပန်းခြံရေကန်လေး — ပတ်ပတ်လည်မှာ ပုန်းလို့ရတယ်
    { kind: "pool", x: 14, z: -12, radius: 4, level: 0.06, color: 0x3f7fae, opacity: 0.75 },
  ],
  fires: [{ x: -14, z: 12, scale: 0.9 }],
  trees: [
    { x: 9, z: 9, kind: "broadleaf", scale: 1.3 },
    { x: -9, z: 9, kind: "broadleaf", scale: 1.1 },
    { x: 9, z: -9, kind: "pine", scale: 1.2 },
    { x: -9, z: -9, kind: "broadleaf", scale: 1.4 },
    { x: 18, z: 2, kind: "pine", scale: 1.1 },
    { x: -18, z: -2, kind: "broadleaf", scale: 1.2 },
    { x: 2, z: 18, kind: "broadleaf", scale: 1.3 },
    { x: -2, z: -18, kind: "pine", scale: 1.1 },
    { x: 26, z: 12, kind: "broadleaf", scale: 1.2 },
    { x: -26, z: -12, kind: "broadleaf", scale: 1.2 },
    { x: 12, z: 26, kind: "pine", scale: 1 },
    { x: -12, z: -26, kind: "broadleaf", scale: 1.3 },
  ],
  lamps: [
    { x: 5, z: 5, color: 0xffd27f },
    { x: -5, z: -5, color: 0xffd27f },
    { x: 17, z: -5, color: 0xffd27f },
    { x: -17, z: 5, color: 0xffd27f },
  ],
  vehicles: [], // game room — ယာဉ်မရှိ
  weather: { default: "clear", allowed: ["clear", "fog", "rain"] },
  ambientSound: "forest",
};
