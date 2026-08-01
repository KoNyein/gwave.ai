"use strict";

/// ရာသီဥတု — **server က ပိုင်တယ်**။
///
/// ★ Client မှာ ကျပန်း လုပ်လို့ မရဘူး — ဘေးချင်းကပ်နေတဲ့ ၂ ယောက်
///   တစ်ယောက်က မိုးထဲ၊ တစ်ယောက်က နေသာနေမယ်။ တစ်လောကထဲမှာ ရှိတယ်ဆိုတာ
///   အဲဒီအခါ အဓိပ္ပာယ် မရှိတော့ဘူး။
/// ★ Map တစ်ခုချင်းမှာ ဖြစ်နိုင်တဲ့ ရာသီဥတု မတူဘူး — နှင်းတောင်ထိပ်မှာ
///   နှင်းပဲ ကျရမယ်၊ ကောင်းကင်ကျွန်းမှာ aurora ရှိတယ်။

/// map id -> ဖြစ်နိုင်တဲ့ ရာသီဥတု (client ရဲ့ `maps/*.ts` နဲ့ ကိုက်ရမယ်)
const ALLOWED = {
  city: ["clear", "clear", "rain", "storm", "fog"],
  farm: ["clear", "clear", "rain", "fog"],
  snow: ["snow", "snow", "blizzard", "fog"],
  sky: ["clear", "clear", "storm", "aurora"],
  main: ["clear"],
  vip: ["clear"],
};

/// ၅–၁၅ မိနစ်တစ်ခါ ပြောင်းတယ် — ဒီထက် မြန်ရင် ရာသီဥတုက ဂိမ်းထဲက
/// အလှည့်ကျ အလင်းရောင်လို ဖြစ်ပြီး သဘာဝ မကျဘူး။
const MIN_MS = 5 * 60 * 1000;
const MAX_MS = 15 * 60 * 1000;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)] ?? "clear";
}

function roll(roomId) {
  const list = ALLOWED[roomId] ?? ALLOWED.city;
  return {
    kind: pick(list),
    intensity: 0.55 + Math.random() * 0.45,
    windX: (Math.random() - 0.5) * 1.6,
    windZ: (Math.random() - 0.5) * 1.6,
    nextAt: Date.now() + MIN_MS + Math.random() * (MAX_MS - MIN_MS),
  };
}

function createWeatherDirector(rooms) {
  const state = new Map();
  for (const r of rooms) state.set(r, roll(r));

  return {
    /// `init` မှာ ထည့်ဖို့ — ဝင်လာသူက ချက်ချင်း မှန်တဲ့ရာသီဥတု မြင်ရမယ်
    get(roomId) {
      const w = state.get(roomId) ?? roll(roomId);
      return { kind: w.kind, intensity: w.intensity, windX: w.windX, windZ: w.windZ };
    },

    /// အချိန်တန်ပြီလား စစ်တယ် — ပြောင်းရင် ပြောင်းသွားတဲ့ room စာရင်း ပြန်ပေး
    due() {
      const now = Date.now();
      const changed = [];
      for (const [roomId, w] of state) {
        if (now < w.nextAt) continue;
        state.set(roomId, roll(roomId));
        changed.push(roomId);
      }
      return changed;
    },

    /// Admin `/weather rain` အတွက်
    force(roomId, kind) {
      const list = ALLOWED[roomId] ?? ALLOWED.city;
      if (!list.includes(kind)) return false;
      const cur = state.get(roomId) ?? roll(roomId);
      state.set(roomId, { ...cur, kind, nextAt: Date.now() + MIN_MS });
      return true;
    },
  };
}

module.exports = { createWeatherDirector, ALLOWED };
