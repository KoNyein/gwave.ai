import type { MapDef, ModelDef } from "./types";

/// ⚔️ Arena — hub world ထဲက **game room** (Assassin)。
///
/// ★ ဒါက social map မဟုတ်ဘူး — room type က server မှာ `game` ဖြစ်ပြီး
///   combat message တွေ ဒီ room မှာပဲ ခွင့်ပြုတယ် (social ၄ ခုမှာ လုံးဝ
///   ငြင်း)。 ယာဉ်/ဆောက်လုပ်ရေးလည်း မရှိဘူး — ပွဲကွင်း သက်သက်။
/// ★ walkRadius 30 က server ရဲ့ assassin.ARENA (30) နဲ့ တစ်ထပ်တည်း —
///   client မြင်ကွင်းက လျှောက်လို့ရတဲ့ ဘောင်ထက် ကျယ်နေရင် "မမြင်ရတဲ့
///   နံရံ" ခံစားချက် ဖြစ်လို့ ဒီကိန်း ၂ ခု ကွဲလို့ မရဘူး။
///
/// v2 — "ground ကို အသေးစိတ်၊ အဆောက်အအုံ/ဆိုင်/NPC ထည့်ပါ" report အရ:
/// · မြေပြင် လင်းအောင် palette မြှင့် + default weather clear (fog က
///   အရင် default မို့ ကွင်းတစ်ခုလုံး မှောင်မည်းနေတယ်)
/// · walk ဧရိယာအပြင် (r>30) မှာ Kenney industrial စက်ရုံတန်း skyline —
///   collider မလို (ရောက်လို့မရတဲ့နေရာ)
/// · ကွင်းအတွင်း ဈေးဆိုင်စင် (shops)၊ လှည်း၊ စည်ပိုင်း/ကန် အကာအကွယ်သစ်
/// · NPC ရွာသားများ — Kenney blocky character (scale 0.2, y:1 က
///   မြေအောက် ၁ unit စူးတာ ပြန်တင်တာ၊ gwave-city ရုပ်တုတွေနဲ့ တူညီ)

const KIT = "/metaverse/kits";

const m = (
  pack: string,
  id: string,
  x: number,
  z: number,
  over: Partial<ModelDef> = {},
): ModelDef => ({ url: `${KIT}/${pack}/${id}.glb`, x, z, ...over });

const crate = (x: number, z: number, s = 2): MapDef["buildings"][number] => ({
  x,
  z,
  w: s,
  h: s,
  d: s,
  color: 0x565c6b,
  roof: "flat",
});

const wall = (x: number, z: number, horizontal: boolean): MapDef["buildings"][number] => ({
  x,
  z,
  w: horizontal ? 7 : 1.2,
  h: 2.2,
  d: horizontal ? 1.2 : 7,
  color: 0x46503c,
  roof: "flat",
});

const ringCrates = (radius: number, count: number, size: number) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + radius; // radius as phase offset
    return crate(Math.cos(a) * radius, Math.sin(a) * radius, size);
  });

/// ── ကွင်းပြင်ပ စက်ရုံ skyline — ရောက်လို့မရလို့ collider မလို ──────────
const BACKDROP: ModelDef[] = [
  m("industrial", "building-a", -44, 18, { ry: 0.6, scale: 7 }),
  m("industrial", "building-f", 42, 24, { ry: -0.7, scale: 7 }),
  m("industrial", "building-l", -40, -26, { ry: 2.3, scale: 7 }),
  m("industrial", "building-r", 44, -18, { ry: -2.2, scale: 7 }),
  m("industrial", "building-e", 6, -46, { ry: 3.1, scale: 7 }),
  m("industrial", "building-b", -10, 46, { ry: 0.1, scale: 7 }),
  m("industrial", "chimney-large", -34, 36, { scale: 7 }),
  m("industrial", "chimney-medium", 36, -36, { scale: 7 }),
  m("industrial", "chimney-small", 34, 38, { scale: 7 }),
];

/// ── ကွင်းအတွင်း ဈေးဆိုင်/ပစ္စည်း — အကာအကွယ်သစ် (AABB collide) ──────────
const PROPS: ModelDef[] = [
  // ဆိုင်စင် ၂ ခု — အရှေ့မြောက်ရပ်ကွက် (ry 90° အဆတိုင်း — AABB စည်းမျဉ်း)
  m("fantasy", "stall-red", 24, 13, { ry: Math.PI, scale: 3.5, collide: { w: 1, d: 1 } }),
  m("fantasy", "stall-green", 19, 20, { ry: -Math.PI / 2, scale: 3.5, collide: { w: 1, d: 1 } }),
  // လှည်းများ — ခိုကွယ်စရာ
  m("fantasy", "cart", -21, 16, { ry: Math.PI / 2, scale: 3.5, collide: { w: 0.7, d: 1.2 } }),
  m("fantasy", "cart-high", 14, -22, { ry: 0, scale: 3.5, collide: { w: 0.7, d: 1.2 } }),
  // ရေကန်/ဓာတ်ငွေ့ကန် — စက်မှုပစ္စည်း အကာ
  m("industrial", "detail-tank", -9, 14, { scale: 5, collide: { w: 0.8, d: 0.5 } }),
  m("industrial", "detail-tank", 8, -14, { ry: Math.PI, scale: 5, collide: { w: 0.8, d: 0.5 } }),
  // ကျောက်တုံး — သဘာဝ အကာ
  m("fantasy", "rock-large", -14, -20, { scale: 3.5, collide: { w: 1, d: 1 } }),
  m("fantasy", "rock-small", 16, 6, { scale: 3.5 }),
  m("fantasy", "rock-small", -6, 22, { ry: 1.9, scale: 3.5 }),
  // အလံတိုင်များ — ရပ်ကွက်အမှတ်အသား (အလှသက်သက်)
  m("fantasy", "banner-red", 12, 12, { scale: 3.5 }),
  m("fantasy", "banner-green", -12, -12, { scale: 3.5 }),
  // မီးအိမ်များ — ညမှာ ကွင်းလမ်းကြောင်း မြင်သာအောင်
  ...[0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    return m("fantasy", "lantern",
      Math.round(Math.cos(a) * 24 * 10) / 10,
      Math.round(Math.sin(a) * 24 * 10) / 10, { scale: 3.5 });
  }),
];

/// ── NPC ရွာသားများ — ဈေးသည်/ကြည့်ရှုသူ (ရုပ်သေ၊ ဆော့ကွင်းအစွန်) ────────
const NPCS: ModelDef[] = [
  m("characters", "character-a", 24.5, 15.5, { ry: -2.2, scale: 0.2, y: 1 }),
  m("characters", "character-d", 17, 22.5, { ry: -2.6, scale: 0.2, y: 1 }),
  m("characters", "character-g", -23, 17.5, { ry: 0.9, scale: 0.2, y: 1 }),
  m("characters", "character-k", -17, -24, { ry: 0.4, scale: 0.2, y: 1 }),
  m("characters", "character-n", 27, -8, { ry: -1.4, scale: 0.2, y: 1 }),
  m("characters", "character-p", -27, 6, { ry: 1.5, scale: 0.2, y: 1 }),
  // မျှော်စင်ထိပ်က စောင့်ကြည့်သူ — y က pre-scale unit မို့ 36×0.2 = 7.2
  m("characters", "character-q", 0, 1.2, { ry: Math.PI, scale: 0.2, y: 36 }),
];

export const ARENA_MAP: MapDef = {
  id: "arena",
  name: "ပွဲကွင်း",
  emoji: "⚔️",
  blurb:
    "Assassin ပွဲကွင်း (၁၈+) — လျှို့ဝှက်ပစ်မှတ်ရှာပြီး ပစ်ခတ်။ ဒီ room မှာပဲ လက်နက်ရတယ်",
  spawn: { x: 0, y: 0, z: 26, ry: Math.PI },
  worldRadius: 50,
  walkRadius: 30,
  palette: {
    // v2 — အရင် palette က မှောင်လွန်းလို့ "ဗလာကွင်း" လို့ မြင်ရတယ်။
    // ညနေစောင်း စက်မှုမြို့ အလင်းရောင် — မြေပြင်/grid ကွဲကွဲပြားပြား။
    ground: 0x3a3f4c,
    grid: 0x525a6b,
    skyDay: 0x8aa7c4,
    skyDusk: 0xcf7a4e,
    skyNight: 0x1c2230,
    fogDay: 0x8a97ab,
    fogNight: 0x181d28,
    fogNear: 34,
    fogFar: 130,
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
    { x: 24, z: 24, w: 3.5, h: 2.6, d: 3.5, color: 0x4a465e, roof: "flat" },
    { x: -24, z: 24, w: 3.5, h: 2.6, d: 3.5, color: 0x4a465e, roof: "flat" },
    { x: 24, z: -24, w: 3.5, h: 2.6, d: 3.5, color: 0x4a465e, roof: "flat" },
    { x: -24, z: -24, w: 3.5, h: 2.6, d: 3.5, color: 0x4a465e, roof: "flat" },
  ],
  water: [],
  fires: [
    { x: 26, z: 0, scale: 1.1 },
    { x: -26, z: 0, scale: 1.1 },
    { x: 0, z: -26, scale: 1.1 },
    { x: 0, z: 28, scale: 0.9 },
  ],
  trees: [
    { x: 21, z: -9, kind: "bare", scale: 1.1 },
    { x: -19, z: 11, kind: "bare", scale: 1.3 },
    { x: 9, z: 22, kind: "bare", scale: 1 },
    { x: -9, z: -25, kind: "bare", scale: 1.2 },
  ],
  lamps: [
    { x: 10, z: 10, color: 0xffa050 },
    { x: -10, z: 10, color: 0xffa050 },
    { x: 10, z: -10, color: 0xffa050 },
    { x: -10, z: -10, color: 0xffa050 },
    { x: 22, z: 22, color: 0xffc070 },
    { x: -22, z: 22, color: 0xffc070 },
    { x: 22, z: -22, color: 0xffc070 },
    { x: -22, z: -22, color: 0xffc070 },
  ],
  vehicles: [], // ပွဲကွင်းမှာ ယာဉ် မရှိ — room type game ရဲ့ စည်းမျဉ်း
  models: [...BACKDROP, ...PROPS, ...NPCS],
  weather: { default: "clear", allowed: ["clear", "fog", "storm"] },
  ambientSound: "wind",
};
