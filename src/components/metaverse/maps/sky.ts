import type { MapDef } from "./types";

/// ☁️ MAP 4 — SKY ISLANDS (ကောင်းကင်ကျွန်းများ)
///
/// ခံစားချက် — မှော်ဆန်၊ လေထဲမှာ ပျံနေတဲ့ ကျွန်းများ၊ ခရမ်း/ပန်းရောင် ကောင်းကင်။
/// ★ ကျွန်းအစွန်းက ကျရင် **သေမှုမရှိဘူး** — အောက်ကျွန်းပေါ် ပြန်ဆင်းရုံပဲ။
///   ပျံနေတဲ့လောကမှာ ကျတိုင်း အစကနေ ပြန်စရရင် ဘယ်သူမှ မကစားချင်တော့ဘူး။

const CRYSTAL = 0x9f7bff;
const TEMPLE = 0xe8dfc8;
const HOME = 0xffb8d9;
const ROCK = 0x8a7f9c;

export const SKY: MapDef = {
  id: "sky",
  name: "ကောင်းကင်ကျွန်းများ",
  emoji: "☁️",
  blurb: "လေထဲမှာ ပျံနေတဲ့ ကျွန်း ၇ ခု၊ ရေတံခွန်နဲ့ portal အခန်း",
  spawn: { x: 0, y: 0, z: 10, ry: Math.PI },
  worldRadius: 95,
  // ★ ဗဟိုကျွန်းရဲ့ အနားသတ် — ဒီထက်ကျော်ရင် လေထဲ လျှောက်နေသလို ဖြစ်တယ်
  walkRadius: 24,
  palette: {
    ground: 0x7ec850,
    grid: 0x9fdc6a,
    skyDay: 0xffd6e8,
    skyDusk: 0xff9ec7,
    skyNight: 0x1a1040,
    fogDay: 0xffe8f4,
    fogNight: 0x201448,
    fogNear: 60,
    fogFar: 200,
  },
  terrain: {
    kind: "islands",
    islands: [
      { x: 0, y: 0, z: 0, r: 26 },
      { x: -42, y: 12, z: -18, r: 16 },
      { x: 40, y: 12, z: -22, r: 15 },
      { x: -30, y: 22, z: 34, r: 14 },
      { x: 34, y: 22, z: 36, r: 14 },
      { x: 0, y: 30, z: -52, r: 13 },
      { x: 2, y: 38, z: 58, r: 12 },
    ],
  },

  buildings: [
    {
      x: -42,
      z: -18,
      w: 12,
      h: 16,
      d: 12,
      color: CRYSTAL,
      roof: "dome",
      roofColor: 0x6b4bd6,
      emissive: 0xd0b0ff,
      label: "🔮 Wizard Tower",
      interior: {
        w: 10,
        h: 14,
        d: 10,
        floorColor: 0x2a1f42,
        wallColor: 0x4a3b6e,
        door: { side: "S", width: 2.4 },
        props: [
          { kind: "shelf", x: -4, y: 0, z: -3, color: 0x3a2c58 },
          { kind: "shelf", x: -4, y: 0, z: 0, color: 0x3a2c58 },
          { kind: "shelf", x: -4, y: 0, z: 3, color: 0x3a2c58 },
          { kind: "table", x: 1, y: 0, z: 0, color: 0x3a2c58 },
          { kind: "lamp", x: 3.4, y: 0, z: -3 },
          { kind: "rug", x: 0, y: 0, z: 2, color: 0x6b3fa0, scale: 1.4 },
        ],
        lights: [
          { x: 0, y: 3, z: 0, color: 0xc07bff, intensity: 1.8 },
          { x: 0, y: 9, z: 0, color: 0x7bd0ff, intensity: 1.4 },
        ],
      },
    },
    {
      x: 40,
      z: -22,
      w: 18,
      h: 10,
      d: 18,
      color: TEMPLE,
      roof: "pyramid",
      roofColor: 0xc9b98f,
      emissive: 0xfff0c0,
      label: "⛩️ Sky Temple",
      interior: {
        w: 16,
        h: 8,
        d: 16,
        floorColor: 0xb9ad8f,
        wallColor: 0xf2ead4,
        door: { side: "S", width: 3.4 },
        props: [
          { kind: "counter", x: 0, y: 0, z: -6, color: 0xc9b98f },
          { kind: "plant", x: -6, y: 0, z: -6 },
          { kind: "plant", x: 6, y: 0, z: -6 },
          { kind: "plant", x: -6, y: 0, z: 6 },
          { kind: "plant", x: 6, y: 0, z: 6 },
          { kind: "rug", x: 0, y: 0, z: 0, color: 0xd8c9a0, scale: 2.4 },
        ],
        lights: [{ x: 0, y: 6, z: 0, color: 0xffe9b0, intensity: 1.6 }],
      },
    },
    {
      x: -30,
      z: 34,
      w: 11,
      h: 6,
      d: 11,
      color: HOME,
      roof: "gable",
      roofColor: 0xd06b9a,
      emissive: 0xffd6ea,
      label: "🏝️ Floating Home",
      interior: {
        w: 9,
        h: 4,
        d: 9,
        floorColor: 0x8a6b7a,
        wallColor: 0xffe4f0,
        door: { side: "N", width: 2.4 },
        props: [
          { kind: "bed", x: -2, y: 0, z: -2.4 },
          { kind: "table", x: 2, y: 0, z: 1 },
          { kind: "chair", x: 2, y: 0, z: 2.4 },
          { kind: "plant", x: -3.4, y: 0, z: 3 },
          { kind: "lamp", x: 3.4, y: 0, z: -3 },
        ],
        lights: [{ x: 0, y: 3.2, z: 0, color: 0xffd6ea, intensity: 1.3 }],
      },
    },
    {
      x: 34,
      z: 36,
      w: 14,
      h: 8,
      d: 14,
      color: ROCK,
      roof: "dome",
      roofColor: 0x5c5270,
      emissive: 0xa0e8ff,
      label: "🌀 Portal Room",
      interior: {
        w: 12,
        h: 6,
        d: 12,
        floorColor: 0x3a3450,
        wallColor: 0x5c5270,
        door: { side: "N", width: 3 },
        props: [
          // portal ၄ ခု — တခြား map ဆီ (Phase 8.4 ရဲ့ အထူးအချက်)
          { kind: "screen", x: -4, y: 1.6, z: -5, color: 0x3f88c5 },
          { kind: "screen", x: 0, y: 1.6, z: -5, color: 0x6cc551 },
          { kind: "screen", x: 4, y: 1.6, z: -5, color: 0xbfe6ff },
          { kind: "rug", x: 0, y: 0, z: 1, color: 0x4a3f7a, scale: 2 },
        ],
        lights: [{ x: 0, y: 4.4, z: 0, color: 0x7bd0ff, intensity: 1.8 }],
      },
    },

    // ဝင်လို့မရတာများ
    { x: 0, z: -52, w: 10, h: 12, d: 10, color: CRYSTAL, roof: "dome", roofColor: 0x6b4bd6 },
    { x: 2, z: 58, w: 9, h: 8, d: 9, color: TEMPLE, roof: "pyramid", roofColor: 0xc9b98f },
    { x: -10, z: -6, w: 8, h: 7, d: 8, color: HOME, roof: "gable", roofColor: 0xd06b9a },
    { x: 12, z: 4, w: 8, h: 6, d: 8, color: ROCK, roof: "dome", roofColor: 0x5c5270 },
    { x: -16, z: 12, w: 7, h: 9, d: 7, color: CRYSTAL, roof: "pyramid", roofColor: 0x6b4bd6 },
    { x: 16, z: -8, w: 7, h: 8, d: 7, color: TEMPLE, roof: "dome", roofColor: 0xc9b98f },
    { x: -6, z: 18, w: 6, h: 6, d: 6, color: HOME, roof: "gable", roofColor: 0xd06b9a },
    { x: 8, z: 16, w: 6, h: 7, d: 6, color: ROCK, roof: "pyramid", roofColor: 0x5c5270 },
  ],

  water: [
    { kind: "lake", x: 0, z: 0, radius: 7, level: 0.1, color: 0x6bc8f0, opacity: 0.66 },
    { kind: "pool", x: -42, z: -10, radius: 3.5, level: 0.1, color: 0x8fd8ff, opacity: 0.6 },
    { kind: "pool", x: 40, z: -14, radius: 3.5, level: 0.1, color: 0x8fd8ff, opacity: 0.6 },
    { kind: "pool", x: -30, z: 42, radius: 3, level: 0.1, color: 0x8fd8ff, opacity: 0.6 },
    { kind: "pool", x: 34, z: 44, radius: 3, level: 0.1, color: 0x8fd8ff, opacity: 0.6 },
  ],

  fires: [
    { x: -6, z: 6, scale: 1 },
    { x: 6, z: 6, scale: 1 },
  ],

  trees: [
    { x: -14, z: -14, kind: "palm", scale: 1.2 },
    { x: 14, z: -14, kind: "palm", scale: 1.2 },
    { x: -18, z: 4, kind: "palm", scale: 1 },
    { x: 18, z: 6, kind: "palm", scale: 1 },
    { x: -38, z: -24, kind: "palm", scale: 0.9 },
    { x: 44, z: -28, kind: "palm", scale: 0.9 },
    { x: -26, z: 40, kind: "palm", scale: 0.9 },
    { x: 30, z: 42, kind: "palm", scale: 0.9 },
  ],

  lamps: [
    { x: -8, z: 0, color: 0xc07bff },
    { x: 8, z: 0, color: 0xc07bff },
    { x: 0, z: -12, color: 0x7bd0ff },
    { x: -40, z: -14, color: 0xc07bff },
    { x: 38, z: -18, color: 0xc07bff },
  ],

  vehicles: [
    // ★ ဒီ map မှာ drone က မဖြစ်မနေ — ကျွန်းချင်း ကူးဖို့
    { kind: "drone", x: -4, z: 4, ry: 0 },
    { kind: "drone", x: 4, z: 4, ry: 0 },
    { kind: "drone", x: -40, z: -22, ry: 0 },
    { kind: "drone", x: 38, z: -26, ry: 0 },
    { kind: "balloon", x: -12, z: 20, ry: 0 },
    { kind: "balloon", x: 14, z: 22, ry: 0 },
  ],

  weather: { default: "clear", allowed: ["clear", "storm", "aurora"] },
  ambientSound: "wind",
};
