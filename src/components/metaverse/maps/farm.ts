import type { MapDef } from "./types";

/// 🌾 MAP 2 — GREEN VALLEY (စိမ်းလန်းချိုင့်ဝှမ်း)
///
/// ခံစားချက် — နွေဦး၊ စိမ်းလန်း၊ နေရောင်နွေးထွေး။ Gwave ရဲ့ hydroponic
/// စိုက်ခင်းနဲ့ တိုက်ရိုက် ချိတ်တဲ့ လောက။

const BARN_RED = 0xb2402f;
const WOOD = 0x9c6b3f;
const GLASS = 0xa8d8e8;
const STONE = 0x8d8b83;

export const FARM: MapDef = {
  id: "farm",
  name: "စိမ်းလန်းချိုင့်ဝှမ်း",
  emoji: "🌾",
  blurb: "လယ်ကွင်း၊ ဖန်အိမ်၊ မြစ်တစ်စင်း — စိုက်ခင်း dashboard နဲ့ ချိတ်ထား",
  spawn: { x: 0, y: 0, z: 16, ry: Math.PI },
  worldRadius: 100,
  palette: {
    ground: 0x5a8c3e,
    grid: 0x6fa04a,
    skyDay: 0x9fd8f5,
    skyDusk: 0xffb26b,
    skyNight: 0x121a2e,
    fogDay: 0xd6ecc8,
    fogNight: 0x141c2c,
    fogNear: 55,
    fogFar: 160,
  },
  // တောင်ကုန်းလှိုင်း — မြေပြင်က ပြားနေရင် လယ်ကွင်းလို မခံစားရဘူး
  terrain: { kind: "hills", amplitude: 2.2, frequency: 0.035 },

  buildings: [
    {
      x: -22,
      z: -14,
      w: 18,
      h: 6,
      d: 12,
      color: GLASS,
      roof: "gable",
      roofColor: 0xcfe9f2,
      emissive: 0xbfffd0,
      label: "🌱 Greenhouse",
      interior: {
        w: 16,
        h: 5,
        d: 10,
        floorColor: 0x6d6a5f,
        wallColor: 0xdff2e4,
        door: { side: "S", width: 3 },
        props: [
          // hydroponic စင် ၈ တန်း — ★ Phase 5.8 က sensor data နဲ့
          // အပင်ကြီးထွားစေဖို့ နေရာချထားတာ
          { kind: "shelf", x: -6, y: 0, z: -3, color: 0x3f7a3a },
          { kind: "shelf", x: -6, y: 0, z: 0, color: 0x3f7a3a },
          { kind: "shelf", x: -6, y: 0, z: 3, color: 0x3f7a3a },
          { kind: "shelf", x: -2, y: 0, z: -3, color: 0x3f7a3a },
          { kind: "shelf", x: -2, y: 0, z: 0, color: 0x3f7a3a },
          { kind: "shelf", x: 2, y: 0, z: -3, color: 0x3f7a3a },
          { kind: "shelf", x: 2, y: 0, z: 0, color: 0x3f7a3a },
          { kind: "shelf", x: 6, y: 0, z: -3, color: 0x3f7a3a },
          { kind: "screen", x: 6, y: 2, z: 4.4, color: 0x0e2a1c },
          { kind: "plant", x: 0, y: 0, z: 3.4 },
        ],
        // grow light — ခရမ်း/ပန်းရောင်
        lights: [
          { x: -4, y: 4, z: 0, color: 0xff88dd, intensity: 1.5 },
          { x: 4, y: 4, z: 0, color: 0xff88dd, intensity: 1.5 },
        ],
      },
    },
    {
      x: 22,
      z: -16,
      w: 16,
      h: 9,
      d: 14,
      color: BARN_RED,
      roof: "gable",
      roofColor: 0x7c2b20,
      emissive: 0xffd28a,
      label: "🚜 Barn",
      interior: {
        w: 14,
        h: 6,
        d: 12,
        floorColor: 0x6b5236,
        wallColor: 0xc7714f,
        door: { side: "S", width: 3.4 },
        props: [
          { kind: "crate", x: -5, y: 0, z: -4 },
          { kind: "crate", x: -3.4, y: 0, z: -4 },
          { kind: "crate", x: -5, y: 0, z: -2.4 },
          { kind: "crate", x: 5, y: 0, z: -4 },
          { kind: "shelf", x: 6, y: 0, z: 2, color: 0x7a5a3a },
          { kind: "table", x: 0, y: 0, z: 0, color: 0x7a5a3a },
        ],
        lights: [{ x: 0, y: 4.6, z: 0, color: 0xffd9a0, intensity: 1.2 }],
      },
    },
    {
      x: -6,
      z: 30,
      w: 12,
      h: 6,
      d: 11,
      color: WOOD,
      roof: "gable",
      roofColor: 0x5c3a22,
      emissive: 0xffd28a,
      label: "🏡 Farmhouse",
      interior: {
        w: 10,
        h: 4,
        d: 9,
        floorColor: 0x7a5a3f,
        wallColor: 0xf0e2cc,
        door: { side: "N", width: 2.4 },
        props: [
          { kind: "counter", x: -3, y: 0, z: -3, color: 0x8b5a2b },
          { kind: "table", x: 1, y: 0, z: 0 },
          { kind: "chair", x: 1, y: 0, z: 1.4 },
          { kind: "chair", x: 1, y: 0, z: -1.4, ry: Math.PI },
          { kind: "bed", x: 3, y: 0, z: 2.6 },
          { kind: "lamp", x: -3.6, y: 0, z: 3 },
        ],
        lights: [{ x: 0, y: 3.2, z: 0, color: 0xffd9a0, intensity: 1.2 }],
      },
    },
    {
      x: 20,
      z: 26,
      w: 12,
      h: 6,
      d: 10,
      color: 0xe8eef2,
      roof: "flat",
      emissive: 0xbfe6ff,
      label: "🧪 Lab",
      interior: {
        w: 10,
        h: 4,
        d: 8,
        floorColor: 0xcfd6dc,
        wallColor: 0xf4f8fb,
        door: { side: "S", width: 2.4 },
        props: [
          { kind: "counter", x: -3, y: 0, z: -2.6, color: 0xdfe6ec },
          { kind: "counter", x: 3, y: 0, z: -2.6, color: 0xdfe6ec },
          { kind: "screen", x: 0, y: 2.1, z: -3.6, color: 0x10202e },
          { kind: "table", x: 0, y: 0, z: 1 },
          { kind: "chair", x: 0, y: 0, z: 2.4 },
        ],
        lights: [{ x: 0, y: 3.4, z: 0, color: 0xffffff, intensity: 1.4 }],
      },
    },
    {
      x: -30,
      z: 24,
      w: 14,
      h: 7,
      d: 10,
      color: WOOD,
      roof: "gable",
      roofColor: 0x5c3a22,
      emissive: 0xffd28a,
      label: "🐴 Stable",
      interior: {
        w: 12,
        h: 5,
        d: 8,
        floorColor: 0x6b5236,
        wallColor: 0xb9885c,
        door: { side: "E", width: 3 },
        props: [
          { kind: "crate", x: -4.6, y: 0, z: -2.6 },
          { kind: "crate", x: -4.6, y: 0, z: 0 },
          { kind: "shelf", x: -4.6, y: 0, z: 2.6, color: 0x7a5a3a },
          { kind: "table", x: 0, y: 0, z: -2.4, color: 0x7a5a3a },
        ],
        lights: [{ x: 0, y: 3.8, z: 0, color: 0xffd9a0, intensity: 1 }],
      },
    },

    // ဝင်လို့မရတာများ
    { x: -48, z: -34, w: 10, h: 5, d: 10, color: WOOD, roof: "gable", roofColor: 0x5c3a22 },
    { x: 46, z: -38, w: 9, h: 5, d: 9, color: WOOD, roof: "gable", roofColor: 0x5c3a22 },
    { x: 52, z: 22, w: 8, h: 8, d: 8, color: STONE, roof: "pyramid", roofColor: 0x6b6960 },
    { x: -52, z: 6, w: 8, h: 9, d: 8, color: STONE, roof: "pyramid", roofColor: 0x6b6960 },
    { x: 4, z: -44, w: 12, h: 6, d: 12, color: BARN_RED, roof: "gable", roofColor: 0x7c2b20 },
    { x: -34, z: -50, w: 10, h: 5, d: 10, color: WOOD, roof: "gable", roofColor: 0x5c3a22 },
    { x: 32, z: 48, w: 10, h: 6, d: 10, color: WOOD, roof: "gable", roofColor: 0x5c3a22 },
    { x: -14, z: 54, w: 9, h: 5, d: 9, color: BARN_RED, roof: "gable", roofColor: 0x7c2b20 },
    { x: 60, z: -6, w: 8, h: 10, d: 8, color: STONE, roof: "dome", roofColor: 0x6b6960 },
    { x: -62, z: 40, w: 9, h: 6, d: 9, color: WOOD, roof: "gable", roofColor: 0x5c3a22 },
    { x: 14, z: 8, w: 5, h: 7, d: 5, color: STONE, roof: "pyramid", roofColor: 0x6b6960 },
  ],

  water: [
    {
      kind: "river",
      points: [
        [-100, 40],
        [-60, 26],
        [-24, 12],
        [10, 2],
        [46, -10],
        [90, -26],
      ],
      level: 0.06,
      color: 0x2f8fbf,
      opacity: 0.7,
      flow: 0.6,
    },
    { kind: "lake", x: 40, z: 0, radius: 12, level: 0.05, color: 0x2a7fa8, opacity: 0.72 },
    { kind: "pool", x: -14, z: 4, radius: 4, level: 0.08, color: 0x3f9fcf, opacity: 0.66 },
  ],

  fires: [
    { x: 8, z: 20, scale: 1.2 },
    { x: -6, z: 26, scale: 0.5 },
  ],

  trees: [
    { x: -40, z: 10, kind: "broadleaf", scale: 1.3 },
    { x: -34, z: 2, kind: "broadleaf", scale: 1.1 },
    { x: 36, z: 34, kind: "broadleaf", scale: 1.2 },
    { x: 44, z: 40, kind: "broadleaf", scale: 1 },
    { x: -56, z: -18, kind: "pine", scale: 1.4 },
    { x: -48, z: -24, kind: "pine", scale: 1.2 },
    { x: 58, z: -30, kind: "pine", scale: 1.3 },
    { x: 64, z: -22, kind: "pine", scale: 1.1 },
    { x: 12, z: 46, kind: "broadleaf", scale: 1.2 },
    { x: -20, z: 44, kind: "broadleaf", scale: 1 },
    { x: 26, z: -34, kind: "broadleaf", scale: 1.1 },
    { x: -8, z: -28, kind: "broadleaf", scale: 0.9 },
  ],

  lamps: [
    { x: -12, z: 20, color: 0xffd9a0 },
    { x: 12, z: 20, color: 0xffd9a0 },
    { x: -22, z: -4, color: 0xffd9a0 },
    { x: 22, z: -4, color: 0xffd9a0 },
    { x: 0, z: 34, color: 0xffd9a0 },
  ],

  vehicles: [
    { kind: "horse", x: -26, z: 18, ry: 0 },
    { kind: "horse", x: -30, z: 16, ry: 0.3 },
    { kind: "horse", x: -34, z: 19, ry: -0.2 },
    { kind: "car", x: 16, z: -8, ry: Math.PI / 2 },
    { kind: "car", x: 26, z: -6, ry: -Math.PI / 2 },
    { kind: "boat", x: 38, z: 4, ry: 0 },
    { kind: "boat", x: 42, z: -2, ry: 0.6 },
    { kind: "boat", x: 12, z: 2, ry: 1.2 },
  ],

  weather: { default: "clear", allowed: ["clear", "rain", "fog"] },
  ambientSound: "forest",
  gwaveLink: { kind: "farm", x: -22, z: -14 },
};
