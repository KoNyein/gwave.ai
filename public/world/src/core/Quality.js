// ============================================================
// Quality.js — 🎚️ **ဂရပ်ဖစ် အဆင့်** (အလို / မြင့် / အလယ် / နိမ့်)
//
// user: "ဂရပ်ဖစ် အနိမ့် ခလုတ် ထည့်ပါ"
// user: "ဂရပ်ဖစ် အနိမ့်အမြင့်ကို auto ပြောင်းပေးပါ"
//
// အဆောက်အအုံ အစစ်တွေ (စေတီတော် ၁၅၅k, ကိုလိုနီအိမ် ၅၆k, အမျိုးသမီးရုပ်
// ၅၆k) ဝင်လာပြီးကတည်းက ရန်ကုန်ရဲ့ တြိဂံက ၁၆၃k → ၃၇၆k တက်သွားတယ်။
// ဖုန်း တစ်လုံးနဲ့တစ်လုံး စွမ်းအား အရမ်းကွာတယ် — ဒါကြောင့် **default က
// အလို (auto)**၊ စက်ကို ကိုယ်တိုင် တိုင်းပြီး ချိန်တယ်။ ကိုယ်တိုင် ချိန်
// ချင်သူအတွက် မြင့်/အလယ်/နိမ့် အသေလည်း ရွေးလို့ရတယ်။
//
// ═══ အဆင့်တစ်ခုချင်း ဘာလုပ်လဲ ═══
//
//   high  — အားလုံး ပြ။ pixelRatio ≤ ၁.၅ (touch) / ၂ (desktop)
//   mid   — အလေးဆုံး အဆောက်အအုံ (စေတီတော်, ကိုလိုနီအိမ်) ဖျောက်။ ≤ ၁.၂၅
//   low   — အထက်ပါ + ထင်းအိမ်/ရုပ်တွေပါ ဖျောက်။ pixelRatio ၁.၀
//
// ★ **pixelRatio က အထိရောက်ဆုံး လက်နက်** — ၁.၅ → ၁.၀ ဆိုရင် shading
//   လုပ်ရမယ့် pixel က ၂.၂၅ ဆ → ၁ ဆ, ဆိုလိုတာ **၅၆% လျော့**。 တြိဂံ
//   ဖျောက်တာထက် အများကြီး ပိုထိရောက်တယ် (ဖုန်း GPU တွေက vertex ထက်
//   fragment နဲ့ပဲ ပိုပင်ပန်းတယ်)。
//
// ═══ အလို (auto) က ဘယ်လို ဆုံးဖြတ်လဲ ═══
//
// ★ ၂ စက္ကန့် တစ်ခေါက် ပျမ်းမျှ FPS တိုင်းတယ်။
//     · ၂၆ အောက် ကျရင် **ချက်ချင်း** တစ်ဆင့် ချ — ကျနေတာကို ခံစားရပြီး
//       သားမို့ နှေးနှေး လုပ်လို့ မဖြစ်ဘူး။
//     · ၅၂ အထက် **၃ ခေါက်ဆက်** (၆ စက္ကန့်) ရမှ တစ်ဆင့် တင် — ပြီးတော့
//       တင်ပြီးနောက် ၃၀ စက္ကန့် ထပ်မတင်ဘူး။ ဒါက **ဟိုတက်ဒီကျ**
//       (flapping) မဖြစ်အောင် — အဆင့် ခဏခဏ ပြောင်းရင် ကျနေတာထက်
//       ပိုဆိုးတယ်。
// ★ dt က engine မှာ ၀.၀၅ (= ၂၀ FPS) ကို အမြင့်ဆုံး ကန့်သတ်ထားတယ်၊
//   ဒါကြောင့် တိုင်းလို့ရတဲ့ အနိမ့်ဆုံးက ၂၀ FPS — ၂၆ ကို ဖြတ်ဖို့ လုံလောက်။
// ============================================================

const KEY = 'gw.world.quality';
/// ခလုတ် နှိပ်တိုင်း ဒီအစဉ်အတိုင်း လှည့်တယ်
export const MODES = ['auto', 'high', 'mid', 'low'];
const TIERS = ['low', 'mid', 'high'];   // အနိမ့် → အမြင့်
export const LABELS = { auto: 'အလို', high: 'မြင့်', mid: 'အလယ်', low: 'နိမ့်' };
export const ICONS = { auto: '⚙️', high: '🎚️', mid: '🎚️', low: '🐢' };

let mode = 'auto';        // user ရွေးထားတာ
let eff = 'high';         // တကယ် သက်ရောက်နေတဲ့ အဆင့်
try {
  const v = localStorage.getItem(KEY);
  if (MODES.includes(v)) mode = v;
} catch { /* private mode */ }
if (mode !== 'auto') eff = mode;

const listeners = new Set();

/// ဖျောက်/ပြ ခံရမယ့် object များ — { obj, tier }
/// tier 'heavy'  = mid ကတည်းက ဖျောက် (စေတီတော်, ကိုလိုနီအိမ် …)
/// tier 'detail' = low မှာမှ ဖျောက် (ထင်းအိမ်, ရပ်နေတဲ့ ရုပ် …)
const tracked = [];

export function getMode() { return mode; }
export function getQuality() { return eff; }

export function setMode(next) {
  if (!MODES.includes(next)) return mode;
  mode = next;
  try { localStorage.setItem(KEY, mode); } catch { /* private */ }
  if (mode !== 'auto') setEffective(mode);
  else resetProbe();       // အလို ပြန်ရွေးရင် အစကနေ ပြန်တိုင်းတယ်
  return mode;
}

/// ခလုတ် တစ်ချက်နှိပ် = နောက်တစ်ဆင့် (အလို → မြင့် → အလယ် → နိမ့် → အလို)
export function cycleMode() {
  return setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
}

/// အဆင့် ပြောင်းတိုင်း သိချင်ရင် (Engine က pixelRatio ချိန်ဖို့ သုံးတယ်)
export function onQualityChange(fn) { listeners.add(fn); fn(eff); }

/// အဆင့် အလိုအလျောက် ပြောင်းသွားရင် UI ကို အသိပေး (toast/ခလုတ် စာသား)
let autoNotify = null;
export function onAutoChange(fn) { autoNotify = fn; }

/**
 * object တစ်ခုကို အဆင့်အလိုက် ဖျောက်/ပြ ဖို့ မှတ်ပုံတင်တယ်။
 * ★ `visible=false` က draw call ရော vertex ရော လုံးဝ ကုန်တယ် —
 *   scene ကနေ ဖြုတ်စရာ မလိုဘူး၊ ပြန်ပြရင်လည်း ချက်ချင်း ပြန်ရတယ်။
 */
export function trackQuality(obj, tier = 'detail') {
  tracked.push({ obj, tier });
  obj.visible = visibleAt(tier, eff);
}

function visibleAt(tier, lv) {
  if (lv === 'high') return true;
  if (lv === 'mid') return tier !== 'heavy';
  return false;              // low — heavy ရော detail ရော ဖျောက်
}

function setEffective(lv) {
  if (lv === eff) return;
  eff = lv;
  for (const t of tracked) t.obj.visible = visibleAt(t.tier, eff);
  for (const fn of listeners) fn(eff);
}

// ── အလို (auto) — FPS တိုင်းပြီး ချိန် ────────────────────────────────
let acc = 0, frames = 0, lowStreak = 0, highStreak = 0, sinceUp = 0, warmup = 0;

function resetProbe() {
  acc = 0; frames = 0; lowStreak = 0; highStreak = 0; sinceUp = 0; warmup = 0;
}

/// engine loop ကနေ frame တိုင်း ခေါ်တယ်
export function sampleFrame(dt) {
  if (mode !== 'auto') return;
  // ★ ပထမ ၃ စက္ကန့် မတိုင်းဘူး — GLB တွေ decode လုပ်နေချိန်မှာ frame က
  //   ကျနေတာ ပုံမှန်ပါ၊ အဲဒါကြောင့် အဆင့်ချလိုက်ရင် မမှန်ဘူး။
  if (warmup < 3) { warmup += dt; return; }
  acc += dt; frames++; sinceUp += dt;
  if (acc < 2) return;
  const fps = frames / acc;
  acc = 0; frames = 0;

  if (fps < 26) { lowStreak++; highStreak = 0; }
  else if (fps > 52) { highStreak++; lowStreak = 0; }
  else { lowStreak = 0; highStreak = 0; }

  const i = TIERS.indexOf(eff);
  if (lowStreak >= 1 && i > 0) {
    setEffective(TIERS[i - 1]);
    lowStreak = 0; sinceUp = 0;
    autoNotify?.(eff, Math.round(fps), 'down');
  } else if (highStreak >= 3 && i < TIERS.length - 1 && sinceUp > 30) {
    setEffective(TIERS[i + 1]);
    highStreak = 0; sinceUp = 0;
    autoNotify?.(eff, Math.round(fps), 'up');
  }
}
