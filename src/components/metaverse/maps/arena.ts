import type { MapDef } from "./types";

/// ⚔️ Arena — hub world ထဲက **game room** (Assassin)。
///
/// ★ ဒါက social map မဟုတ်ဘူး — room type က server မှာ `game` ဖြစ်ပြီး
///   combat message တွေ ဒီ room မှာပဲ ခွင့်ပြုတယ် (social ၄ ခုမှာ လုံးဝ
///   ငြင်း)。 ယာဉ်/ဆောက်လုပ်ရေးလည်း မရှိဘူး — ပွဲကွင်း သက်သက်။
/// ★ walkRadius 30 က server ရဲ့ assassin.ARENA (30) နဲ့ တစ်ထပ်တည်း —
///   client မြင်ကွင်းက လျှောက်လို့ရတဲ့ ဘောင်ထက် ကျယ်နေရင် "မမြင်ရတဲ့
///   နံရံ" ခံစားချက် ဖြစ်လို့ ဒီကိန်း ၂ ခု ကွဲလို့ မရဘူး။
///
/// အကွက် — ဗဟို စောင့်ကြည့်မျှော်စင်၊ အကာ crate ၂ ကွင်း (r20/r12) နဲ့
/// ထောင့် bunker ၄ ခု — ပွင့်နေတဲ့မြေ မကျန်အောင် (arena spec A2 ရဲ့
/// "no exposed ground" စည်းမျဉ်း)、 ဒါပေမယ့် hub engine ရဲ့ BuildingDef
/// တွေနဲ့ပဲ ဆောက်ထားလို့ collision/မြေပုံ/မီးအလင်း အားလုံး အလိုလို ရတယ်။

const crate = (x: number, z: number, s = 2): MapDef["buildings"][number] => ({
  x,
  z,
  w: s,
  h: s,
  d: s,
  color: 0x4a4f5c,
  roof: "flat",
});

const wall = (x: number, z: number, horizontal: boolean): MapDef["buildings"][number] => ({
  x,
  z,
  w: horizontal ? 7 : 1.2,
  h: 2.2,
  d: horizontal ? 1.2 : 7,
  color: 0x3a4030,
  roof: "flat",
});

const ringCrates = (radius: number, count: number, size: number) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + radius; // radius as phase offset
    return crate(Math.cos(a) * radius, Math.sin(a) * radius, size);
  });

export const ARENA_MAP: MapDef = {
  id: "arena",
  name: "ပွဲကွင်း",
  emoji: "⚔️",
  blurb:
    "Assassin ပွဲကွင်း (၁၈+) — လျှို့ဝှက်ပစ်မှတ်ရှာပြီး ပစ်ခတ်။ ဒီ room မှာပဲ လက်နက်ရတယ်",
  spawn: { x: 0, y: 0, z: 26, ry: Math.PI },
  worldRadius: 36,
  walkRadius: 30,
  palette: {
    // မှောင်ပြီး ရင်ခုန်စရာ — social map တွေနဲ့ တခြားစီဆိုတာ ရောက်တာနဲ့ သိရအောင်
    ground: 0x23262e,
    grid: 0x343947,
    skyDay: 0x3a4152,
    skyDusk: 0x2c2436,
    skyNight: 0x141821,
    fogDay: 0x2e3340,
    fogNight: 0x10131a,
    fogNear: 24,
    fogFar: 90,
  },
  terrain: { kind: "flat" },
  buildings: [
    // ဗဟို မျှော်စင် — မြေပြင်စစ်မျက်နှာရဲ့ အချက်အချာ
    { x: 0, z: 0, w: 4, h: 7, d: 4, color: 0x565c6b, roof: "pyramid", roofColor: 0x767d8f, label: "မျှော်စင်" },
    // အကာကွင်း ၂ ကွင်း
    ...ringCrates(20, 8, 2.2),
    ...ringCrates(12, 6, 1.8),
    // ရှည်တဲ့ အကာနံရံ ၄ ခု (ထောင့်ဖြတ် လမ်းကြောင်းတွေကို ပိတ်)
    wall(16, 0, false),
    wall(-16, 0, false),
    wall(0, 16, true),
    wall(0, -16, true),
    // ထောင့် bunker ၄ ခု — spawn နေရာအနီး အကာ
    { x: 24, z: 24, w: 3.5, h: 2.6, d: 3.5, color: 0x44405a, roof: "flat" },
    { x: -24, z: 24, w: 3.5, h: 2.6, d: 3.5, color: 0x44405a, roof: "flat" },
    { x: 24, z: -24, w: 3.5, h: 2.6, d: 3.5, color: 0x44405a, roof: "flat" },
    { x: -24, z: -24, w: 3.5, h: 2.6, d: 3.5, color: 0x44405a, roof: "flat" },
  ],
  water: [],
  fires: [
    { x: 26, z: 0, scale: 1.1 },
    { x: -26, z: 0, scale: 1.1 },
    { x: 0, z: -26, scale: 1.1 },
  ],
  trees: [
    { x: 21, z: -9, kind: "bare", scale: 1.1 },
    { x: -19, z: 11, kind: "bare", scale: 1.3 },
    { x: 9, z: 22, kind: "bare", scale: 1 },
  ],
  lamps: [
    { x: 10, z: 10, color: 0xff8844 },
    { x: -10, z: 10, color: 0xff8844 },
    { x: 10, z: -10, color: 0xff8844 },
    { x: -10, z: -10, color: 0xff8844 },
  ],
  vehicles: [], // ပွဲကွင်းမှာ ယာဉ် မရှိ — room type game ရဲ့ စည်းမျဉ်း
  weather: { default: "fog", allowed: ["clear", "fog", "storm"] },
  ambientSound: "wind",
};
