import type { MapDef } from "./types";

/// 🎯 Assassin Alley — ASSASSIN ရဲ့ ကိုယ်ပိုင် game room။
///
/// ★ Room id `assassin-alley` (server: type social — combat layer မလို၊
///   assassin mini-game က position-tag စနစ်)။ Game Zone cabinet က ဒီ room
///   ထဲ ပို့ပြီး "🎯 Assassin" mini-game ကို အလိုအလျောက် join ပေးတယ်။
/// ★ ညအချိန် လမ်းကြားမြို့ — မြင်ကွင်းကျဉ်းတဲ့ လမ်းကြား maze၊ မီးအိမ်
///   နည်းနည်း၊ မြူပါ။ ပစ်မှတ်ကို 8m grid hint နဲ့ လိုက်ရှာရတာ ဒီလို
///   မြင်ကွင်းကျဉ်းမှ စိတ်လှုပ်ရှားစရာ ဖြစ်တယ်။

const wall = (x: number, z: number, horizontal: boolean, len = 8): MapDef["buildings"][number] => ({
  x,
  z,
  w: horizontal ? len : 1.2,
  h: 3.2, // ခေါင်းကျော် မမြင်ရတဲ့ အမြင့် — hide map ထက် ရင့်တယ်
  d: horizontal ? 1.2 : len,
  color: 0x3a3f4c,
  roof: "flat",
});

const block = (x: number, z: number, s: number, color: number): MapDef["buildings"][number] => ({
  x,
  z,
  w: s,
  h: 4.6,
  d: s,
  color,
  roof: "flat",
  emissive: 0x8a5a2a,
});

export const ASSASSIN_ALLEY: MapDef = {
  id: "assassin-alley",
  name: "Assassin လမ်းကြား",
  emoji: "🎯",
  blurb: "ညမြို့လမ်းကြား maze — ပစ်မှတ်ကို လျှို့ဝှက်ချဉ်းကပ် eliminate",
  spawn: { x: 0, y: 0, z: 26, ry: Math.PI },
  worldRadius: 44,
  walkRadius: 38,
  palette: {
    // ညမြို့ — မီးခိုးမဲပြာ၊ မြူဆိုင်း
    ground: 0x23262e,
    grid: 0x2d313c,
    skyDay: 0x4a5468,
    skyDusk: 0x3a3448,
    skyNight: 0x0d1018,
    fogDay: 0x3c4454,
    fogNight: 0x0a0d14,
    fogNear: 16,
    fogFar: 70,
  },
  terrain: { kind: "flat" },
  buildings: [
    // မြို့ကွက် — လမ်းကြားတွေ ဖြစ်အောင် အကွက်ကြီး ၆ ခု
    block(-14, -12, 8, 0x424858),
    block(2, -16, 7, 0x3c4250),
    block(16, -8, 8, 0x474d5c),
    block(-16, 8, 7, 0x3e4452),
    block(12, 12, 8, 0x444a5a),
    block(-2, 2, 6, 0x40465a),
    // လမ်းကြား နံရံတိုတွေ — ချောင်းကြည့်/ပုန်းစရာ
    wall(-6, -6, false, 6),
    wall(8, 2, true, 6),
    wall(-10, 18, true, 7),
    wall(6, 22, false, 6),
    wall(22, 2, false, 7),
    wall(-24, -2, false, 7),
    wall(-4, -24, true, 7),
    wall(14, -22, true, 6),
    // ထောင့်စွန် crate စုပုံများ
    { x: 24, z: 20, w: 2, h: 1.4, d: 2, color: 0x6b5a3a, roof: "flat" },
    { x: -24, z: -20, w: 2, h: 1.4, d: 2, color: 0x6b5a3a, roof: "flat" },
    { x: -22, z: 22, w: 2, h: 1.4, d: 2, color: 0x5a4a30, roof: "flat" },
  ],
  water: [],
  fires: [
    // မီးပုံးအိုးလေးတွေ — ရိပ်ထဲက အလင်းစက်ဝိုင်းကျဉ်း
    { x: 10, z: -4, scale: 0.7 },
    { x: -12, z: 14, scale: 0.7 },
  ],
  trees: [
    { x: 26, z: -16, kind: "bare", scale: 1.2 },
    { x: -28, z: 12, kind: "bare", scale: 1.1 },
    { x: 18, z: 26, kind: "bare", scale: 1.3 },
    { x: -8, z: -28, kind: "bare", scale: 1.2 },
  ],
  lamps: [
    // မီးအိမ် နည်းနည်းသာ — အလင်းအောက်မှာ မြင်သာ၊ ရိပ်ထဲမှာ ပျောက်
    { x: 0, z: 12, color: 0xffb46a },
    { x: -18, z: -8, color: 0xffb46a },
    { x: 20, z: 6, color: 0xffb46a },
  ],
  vehicles: [], // game room — ယာဉ်မရှိ၊ ခြေလျင် လိုက်တမ်း
  weather: { default: "fog", allowed: ["fog", "rain", "clear"] },
  ambientSound: "city",
};
