import type { MapDef } from "./types";

/// 🚁 Drone Valley — GWAVE DRONE ရဲ့ ကိုယ်ပိုင် game room။
///
/// ★ Room id `drone-race` (server: type social — 🛸 drone ယာဉ်တွေ လိုလို့)။
///   ဒီ room ထဲရောက်ရင် "🚁 Drone ပြိုင်ပွဲ" mini-game ကို Game Zone cabinet
///   က အလိုအလျောက် join ပေးတယ် — ကောင်းကင် ring ၇ ခုက mini-game ရဲ့
///   objective marker တွေအဖြစ် ပေါ်တယ် (server မှာသာ အမှန်ရှိတယ်)။
/// ★ တောင်ကြားလွင်ပြင် — ပျံသန်းဖို့ လွတ်လပ်တဲ့ နေရာကျယ်၊ အနားမှာ
///   hangar/control tower နဲ့ launch pad တွေ။ Drone ၆ စီး တန်းစီထား။

const pad = (x: number, z: number): NonNullable<MapDef["platforms"]>[number] => ({
  x,
  z,
  w: 4,
  d: 4,
  y: 0.25,
  color: 0x2b3542,
});

export const DRONE_VALLEY: MapDef = {
  id: "drone-race",
  name: "Drone တောင်ကြား",
  emoji: "🚁",
  blurb: "🛸 စီးပြီး ကောင်းကင် ring ၇ ခု ဖြတ်ပြိုင် — Drone ပြိုင်ပွဲကွင်း",
  spawn: { x: 0, y: 0, z: 14, ry: Math.PI },
  worldRadius: 80,
  walkRadius: 70,
  palette: {
    // မနက်ခင်း တောင်ကြားစိမ်း — ပျံသန်းချင်စဖွယ်
    ground: 0x38683c,
    grid: 0x47784a,
    skyDay: 0x8ec8ef,
    skyDusk: 0xf0a868,
    skyNight: 0x16203a,
    fogDay: 0xaed4ea,
    fogNight: 0x101828,
    fogNear: 60,
    fogFar: 240,
  },
  terrain: { kind: "hills", amplitude: 0.8, frequency: 0.05 },
  buildings: [
    // Hangar — drone သိုလှောင်ရုံ (ဝင်လို့ရ)
    {
      x: -18, z: 6, w: 10, h: 4.5, d: 8, color: 0x9aa7b4, roof: "flat",
      emissive: 0x35e0b8, label: "HANGAR",
      interior: {
        w: 9, h: 4, d: 7, floorColor: 0x3a424e, wallColor: 0x59636f,
        door: { side: "E", width: 2.4 },
        props: [
          { kind: "crate", x: -3, y: 0, z: -2 },
          { kind: "crate", x: -3, y: 0, z: 0 },
          { kind: "shelf", x: 3, y: 0, z: -2.4 },
          { kind: "counter", x: 0, y: 0, z: -2.8 },
          { kind: "screen", x: 0, y: 2, z: -3.3, color: 0x123528 },
        ],
        lights: [{ x: 0, y: 3.4, z: 0, color: 0xd8f4ff, intensity: 1.3 }],
      },
    },
    // Control tower — မြင့်တဲ့ မျှော်စင်
    { x: 18, z: 4, w: 3.4, h: 9, d: 3.4, color: 0x8794a2, roof: "flat", emissive: 0xffd27f, label: "TOWER" },
  ],
  water: [
    // တောင်ကြားချောင်း — အလှ + အနိမ့်ပျံ reference
    { kind: "lake", x: -30, z: -28, radius: 12, level: 0.05, color: 0x3f7fae, opacity: 0.75 },
  ],
  fires: [],
  trees: [
    { x: 30, z: -18, kind: "pine", scale: 1.4 },
    { x: 34, z: -10, kind: "pine", scale: 1.1 },
    { x: -36, z: 14, kind: "pine", scale: 1.3 },
    { x: -30, z: 34, kind: "broadleaf", scale: 1.2 },
    { x: 26, z: 36, kind: "pine", scale: 1.2 },
    { x: 44, z: 12, kind: "pine", scale: 1.5 },
    { x: -46, z: -8, kind: "pine", scale: 1.3 },
    { x: 8, z: -42, kind: "broadleaf", scale: 1.3 },
    { x: -12, z: -46, kind: "pine", scale: 1.2 },
    { x: 48, z: 30, kind: "pine", scale: 1.1 },
  ],
  lamps: [
    { x: -6, z: 8, color: 0x9ad7ff },
    { x: 6, z: 8, color: 0x9ad7ff },
    { x: -14, z: 20, color: 0x9ad7ff },
    { x: 14, z: 20, color: 0x9ad7ff },
  ],
  // 🛸 drone ၆ စီး — launch pad တွေပေါ် တန်းစီထား
  vehicles: [
    { kind: "drone", x: -10, z: 18, ry: Math.PI },
    { kind: "drone", x: -5, z: 18, ry: Math.PI },
    { kind: "drone", x: 0, z: 18, ry: Math.PI },
    { kind: "drone", x: 5, z: 18, ry: Math.PI },
    { kind: "drone", x: 10, z: 18, ry: Math.PI },
    { kind: "drone", x: 0, z: -8, ry: 0 },
  ],
  platforms: [pad(-10, 18), pad(-5, 18), pad(0, 18), pad(5, 18), pad(10, 18)],
  weather: { default: "clear", allowed: ["clear", "fog", "rain"] },
  ambientSound: "wind",
};
