import type { MapDef } from "./types";

/// 🏁 Champions Circuit — DRONE CHAMPIONS ရဲ့ ကိုယ်ပိုင် game room။
///
/// ★ Room id `champions` (server: type social — ကား/drone နှစ်မျိုးလုံး
///   စီးပြီး ပြိုင်လို့ရအောင်)။ Game Zone cabinet က ဒီ room ထဲ ပို့ပြီး
///   "🏁 အပြေးပြိုင်ပွဲ" mini-game ကို အလိုအလျောက် join ပေးတယ် —
///   checkpoint တွေက mini-game marker တွေအဖြစ် ပေါ်တယ်။
/// ★ ပြိုင်ကွင်းပုံစံ — ပွဲကြည့်စင်တန်းကြီး ၂ ခု၊ pit ဆောက်အအုံ၊
///   start/finish မုခ်ဦး (နောက်ဆုံး checkpoint (0,12) မှာ)။

const stand = (x: number, z: number, w: number, d: number): MapDef["buildings"][number] => ({
  x,
  z,
  w,
  h: 4,
  d,
  color: 0x6b7686,
  roof: "flat",
  roofColor: 0xd94f4f,
  emissive: 0xffe9c8,
});

export const CHAMPIONS_CIRCUIT: MapDef = {
  id: "champions",
  name: "Champions ပြိုင်ကွင်း",
  emoji: "🏁",
  blurb: "Checkpoint ပြိုင်ပွဲကွင်း — ခြေလျင်၊ ကား၊ drone ကြိုက်တာနဲ့ ပြိုင်",
  spawn: { x: 0, y: 0, z: 18, ry: Math.PI },
  worldRadius: 70,
  walkRadius: 62,
  palette: {
    // နေ့ခင်း ပြိုင်ကွင်း — မြက်စိမ်း + လမ်းမီးခိုး
    ground: 0x4a6b45,
    grid: 0x5a7a52,
    skyDay: 0x93c8ec,
    skyDusk: 0xf0a868,
    skyNight: 0x171f33,
    fogDay: 0xb4d6e8,
    fogNight: 0x121a2a,
    fogNear: 55,
    fogFar: 220,
  },
  terrain: { kind: "flat" },
  buildings: [
    // ပွဲကြည့်စင် — အရှေ့/အနောက် တန်းကြီး ၂ ခု
    stand(0, -52, 40, 6),
    stand(-52, 0, 6, 36),
    // Pit ဆောက်အအုံ (ဝင်လို့ရ)
    {
      x: 46, z: 18, w: 12, h: 3.6, d: 7, color: 0x8b95a4, roof: "flat",
      emissive: 0x3f88c5, label: "PIT",
      interior: {
        w: 11, h: 3.2, d: 6, floorColor: 0x39404c, wallColor: 0x5a6472,
        door: { side: "W", width: 2.6 },
        props: [
          { kind: "counter", x: 3.6, y: 0, z: -2 },
          { kind: "crate", x: -3.5, y: 0, z: -1.8 },
          { kind: "crate", x: -3.5, y: 0, z: 0 },
          { kind: "screen", x: 0, y: 1.8, z: -2.7, color: 0x14301f },
          { kind: "table", x: 0, y: 0, z: 1 },
        ],
        lights: [{ x: 0, y: 2.8, z: 0, color: 0xffffff, intensity: 1.2 }],
      },
    },
    // Start/finish မုခ်ဦးတိုင် ၂ တိုင် — checkpoint (0,12) ရဲ့ ဘေးနှစ်ဘက်
    { x: -6, z: 12, w: 1, h: 6.5, d: 1, color: 0xd94f4f, roof: "flat" },
    { x: 6, z: 12, w: 1, h: 6.5, d: 1, color: 0xd94f4f, roof: "flat" },
  ],
  water: [],
  fires: [],
  trees: [
    { x: 30, z: -30, kind: "broadleaf", scale: 1.2 },
    { x: -32, z: 30, kind: "broadleaf", scale: 1.3 },
    { x: 40, z: -12, kind: "pine", scale: 1.1 },
    { x: -40, z: -20, kind: "broadleaf", scale: 1.2 },
    { x: 16, z: 44, kind: "pine", scale: 1.2 },
    { x: -18, z: 46, kind: "broadleaf", scale: 1.1 },
  ],
  lamps: [
    // Checkpoint လမ်းကြောင်းတလျှောက် မီးတိုင်တွေ — ညပြိုင်လို့ရအောင်
    { x: 20, z: -10, color: 0xffd27f },
    { x: 30, z: 25, color: 0xffd27f },
    { x: -5, z: 40, color: 0xffd27f },
    { x: -30, z: 10, color: 0xffd27f },
    { x: 0, z: 12, color: 0x9ad7ff },
  ],
  vehicles: [
    { kind: "car", x: -8, z: 22, ry: Math.PI },
    { kind: "car", x: -4, z: 22, ry: Math.PI },
    { kind: "car", x: 4, z: 22, ry: Math.PI },
    { kind: "car", x: 8, z: 22, ry: Math.PI },
    { kind: "drone", x: -14, z: 22, ry: Math.PI },
    { kind: "drone", x: 14, z: 22, ry: Math.PI },
  ],
  weather: { default: "clear", allowed: ["clear", "rain", "fog"] },
  ambientSound: "city",
};
