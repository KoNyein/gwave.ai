import type { MapDef } from "./types";

/// ❄️ MAP 3 — SNOW PEAK (နှင်းတောင်ထိပ်)
///
/// ခံစားချက် — အေးစက်၊ အဖြူရောင်၊ နှင်းကျ။ တောင်ပေါ်ရွာလေး။
/// ★ မြူက ထူတယ် (fogNear 25) — အဲဒါက ခံစားချက်ပဲ မဟုတ်ဘူး၊ ဝေးရာက
///   အရာတွေကို ဖုံးပေးလို့ ဖုန်းအဟောင်းမှာ frame ပိုကောင်းတယ်။

const CABIN = 0x8b5a3c;
const ROOF_RED = 0xa8332a;
const LODGE_WOOD = 0x6b4630;
const STONE = 0x9aa5ad;
const WARM_WALL = 0xd8b892;

export const SNOW: MapDef = {
  id: "snow",
  name: "နှင်းတောင်ထိပ်",
  emoji: "❄️",
  blurb: "နှင်းကျနေတဲ့ တောင်ပေါ်ရွာ၊ မီးလုံလောင်ဗူးနဲ့ lodge",
  spawn: { x: 0, y: 0, z: 14, ry: Math.PI },
  worldRadius: 85,
  palette: {
    ground: 0xe8f0f5,
    grid: 0xc8d8e5,
    skyDay: 0xb8d8f0,
    skyDusk: 0xe8a0a0,
    skyNight: 0x0a1428,
    fogDay: 0xdce8f0,
    fogNight: 0x0e1626,
    fogNear: 25,
    fogFar: 90,
  },
  terrain: {
    kind: "peaks",
    peaks: [
      { x: -44, z: -40, r: 30, h: 34 },
      { x: 46, z: -34, r: 26, h: 28 },
      { x: 6, z: -64, r: 24, h: 40 },
    ],
  },

  buildings: [
    {
      x: -18,
      z: -12,
      w: 20,
      h: 9,
      d: 16,
      color: LODGE_WOOD,
      roof: "gable",
      roofColor: ROOF_RED,
      emissive: 0xffb870,
      label: "🔥 Ski Lodge",
      interior: {
        w: 18,
        h: 6,
        d: 14,
        floorColor: 0x5c3f2a,
        wallColor: WARM_WALL,
        door: { side: "S", width: 3.2 },
        props: [
          { kind: "counter", x: -6, y: 0, z: -5, color: 0x4a3320 },
          { kind: "table", x: 2, y: 0, z: -1 },
          { kind: "table", x: 5, y: 0, z: 2 },
          { kind: "chair", x: 2, y: 0, z: 0.4 },
          { kind: "chair", x: 2, y: 0, z: -2.4, ry: Math.PI },
          { kind: "chair", x: 5, y: 0, z: 3.4 },
          { kind: "rug", x: -1, y: 0, z: 3, color: 0x7a3b2e, scale: 1.8 },
          { kind: "shelf", x: -8, y: 0, z: 2, color: 0x4a3320 },
          { kind: "plant", x: 7.5, y: 0, z: -5 },
        ],
        // မီးလုံလောင်ဗူး — အနီ/လိမ္မော် အလင်း၊ အေးတဲ့လောကထဲမှာ နွေးထွေးမှု
        lights: [
          { x: -6, y: 1.4, z: 5, color: 0xff9440, intensity: 2.2 },
          { x: 2, y: 4.6, z: 0, color: 0xffd9a0, intensity: 0.9 },
        ],
      },
    },
    {
      x: 16,
      z: -6,
      w: 10,
      h: 5,
      d: 10,
      color: CABIN,
      roof: "gable",
      roofColor: ROOF_RED,
      emissive: 0xffb870,
      label: "🏔️ Cabin",
      interior: {
        w: 8,
        h: 3.5,
        d: 8,
        floorColor: 0x5c3f2a,
        wallColor: WARM_WALL,
        door: { side: "W", width: 2.2 },
        props: [
          { kind: "bed", x: -2, y: 0, z: -2.4 },
          { kind: "shelf", x: 3.2, y: 0, z: -1, color: 0x4a3320 },
          { kind: "table", x: 1.4, y: 0, z: 2 },
          { kind: "lamp", x: -3, y: 0, z: 2.8 },
        ],
        lights: [{ x: 0, y: 1.2, z: -3, color: 0xff9440, intensity: 1.8 }],
      },
    },
    {
      x: 28,
      z: 14,
      w: 10,
      h: 5,
      d: 10,
      color: CABIN,
      roof: "gable",
      roofColor: ROOF_RED,
      emissive: 0xffb870,
      label: "🏔️ Cabin",
      interior: {
        w: 8,
        h: 3.5,
        d: 8,
        floorColor: 0x5c3f2a,
        wallColor: WARM_WALL,
        door: { side: "N", width: 2.2 },
        props: [
          { kind: "bed", x: 2, y: 0, z: 2.4 },
          { kind: "shelf", x: -3.2, y: 0, z: 1, color: 0x4a3320 },
          { kind: "table", x: -1.4, y: 0, z: -2 },
          { kind: "lamp", x: 3, y: 0, z: -2.8 },
        ],
        lights: [{ x: 0, y: 1.2, z: 3, color: 0xff9440, intensity: 1.8 }],
      },
    },
    {
      x: -6,
      z: 24,
      w: 12,
      h: 6,
      d: 10,
      color: 0x4a6b7a,
      roof: "gable",
      roofColor: 0x2f4652,
      emissive: 0xbfe6ff,
      label: "⛷️ Gear Shop",
      interior: {
        w: 10,
        h: 4,
        d: 8,
        floorColor: 0x59636b,
        wallColor: 0xdfe9ef,
        door: { side: "N", width: 2.4 },
        props: [
          { kind: "shelf", x: -4, y: 0, z: -2 },
          { kind: "shelf", x: -4, y: 0, z: 1 },
          { kind: "shelf", x: 4, y: 0, z: -2 },
          { kind: "counter", x: 0, y: 0, z: -3.2, color: 0x3f4d57 },
          { kind: "crate", x: 3.4, y: 0, z: 2.4 },
        ],
        lights: [{ x: 0, y: 3.4, z: 0, color: 0xffffff, intensity: 1.2 }],
      },
    },
    {
      x: 4,
      z: -30,
      w: 8,
      h: 16,
      d: 8,
      color: STONE,
      roof: "pyramid",
      roofColor: 0x5c6870,
      emissive: 0xffe6a0,
      label: "🕰️ Clock Tower",
      interior: {
        w: 6,
        h: 12,
        d: 6,
        floorColor: 0x6b7076,
        wallColor: 0xb9c3ca,
        door: { side: "S", width: 2 },
        props: [
          { kind: "shelf", x: -2, y: 0, z: -2, color: 0x5c6870 },
          { kind: "lamp", x: 2, y: 0, z: 2 },
        ],
        lights: [
          { x: 0, y: 3, z: 0, color: 0xffe6a0, intensity: 1 },
          { x: 0, y: 9, z: 0, color: 0xffe6a0, intensity: 1 },
        ],
      },
    },

    // ဝင်လို့မရတာများ — ရွာရဲ့ အခင်းအကျင်း
    { x: -36, z: 18, w: 9, h: 5, d: 9, color: CABIN, roof: "gable", roofColor: ROOF_RED },
    { x: -44, z: 6, w: 8, h: 4, d: 8, color: CABIN, roof: "gable", roofColor: ROOF_RED },
    { x: 40, z: 26, w: 9, h: 5, d: 9, color: CABIN, roof: "gable", roofColor: ROOF_RED },
    { x: 48, z: 4, w: 8, h: 4, d: 8, color: CABIN, roof: "gable", roofColor: ROOF_RED },
    { x: -28, z: 44, w: 10, h: 6, d: 10, color: LODGE_WOOD, roof: "gable", roofColor: ROOF_RED },
    { x: 20, z: 46, w: 9, h: 5, d: 9, color: CABIN, roof: "gable", roofColor: ROOF_RED },
    { x: -54, z: -14, w: 8, h: 7, d: 8, color: STONE, roof: "pyramid", roofColor: 0x5c6870 },
    { x: 58, z: -12, w: 8, h: 7, d: 8, color: STONE, roof: "pyramid", roofColor: 0x5c6870 },
    { x: 0, z: 50, w: 10, h: 5, d: 10, color: CABIN, roof: "gable", roofColor: ROOF_RED },
  ],

  water: [
    // ရေခဲကန် — အပေါ်က လျှောက်လို့ရမယ့် အလွှာ (Phase 10)
    { kind: "lake", x: -34, z: -2, radius: 14, level: 0.04, color: 0xbfe4f0, opacity: 0.55 },
    { kind: "pool", x: 34, z: -22, radius: 5, level: 0.04, color: 0xa8d8ea, opacity: 0.6 },
  ],

  fires: [
    { x: 0, z: 6, scale: 1.3 },
    { x: -26, z: 26, scale: 0.9 },
    { x: 24, z: 30, scale: 0.9 },
  ],

  trees: [
    { x: -30, z: -26, kind: "pine", scale: 1.4 },
    { x: -24, z: -32, kind: "pine", scale: 1.2 },
    { x: -38, z: -20, kind: "pine", scale: 1.5 },
    { x: 30, z: -26, kind: "pine", scale: 1.3 },
    { x: 36, z: -18, kind: "pine", scale: 1.5 },
    { x: 24, z: -34, kind: "pine", scale: 1.1 },
    { x: -46, z: 32, kind: "pine", scale: 1.2 },
    { x: -52, z: 24, kind: "pine", scale: 1.4 },
    { x: 46, z: 38, kind: "pine", scale: 1.3 },
    { x: 54, z: 30, kind: "pine", scale: 1.1 },
    { x: 12, z: 34, kind: "bare", scale: 1 },
    { x: -12, z: 40, kind: "bare", scale: 1.1 },
  ],

  lamps: [
    { x: -10, z: 6, color: 0xffd9a0 },
    { x: 10, z: 6, color: 0xffd9a0 },
    { x: -20, z: 20, color: 0xffd9a0 },
    { x: 20, z: 20, color: 0xffd9a0 },
    { x: 0, z: -18, color: 0xffd9a0 },
  ],

  vehicles: [
    { kind: "snowmobile", x: -10, z: 14, ry: 0 },
    { kind: "snowmobile", x: 10, z: 14, ry: 0 },
    { kind: "drone", x: -4, z: -4, ry: 0 },
    { kind: "drone", x: 6, z: -2, ry: 0 },
  ],

  weather: { default: "snow", allowed: ["snow", "blizzard", "fog"] },
  ambientSound: "wind",
};
