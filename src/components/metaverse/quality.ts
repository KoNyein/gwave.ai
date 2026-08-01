/// Adaptive quality — **ဒါက ရွေးစရာမဟုတ်ဘူး**။
///
/// Mae Sot ဘက်မှာ ဖုန်းအဟောင်း သုံးသူများတယ်။ Bloom + shadow + pixelRatio 2
/// နဲ့ ဖွင့်လိုက်ရင် စက္ကန့်တစ်ခုကို frame ၅ ခုပဲ ရမယ် — အဲဒါက "နှေးတယ်"
/// မဟုတ်ဘူး၊ "မရဘူး"။ ကိုယ်တိုင် ခလုတ်ရှာပြီး ပိတ်ဖို့ မျှော်လင့်လို့မရဘူး၊
/// အများစုက အဲဒီအချိန်မှာ tab ကို ပိတ်လိုက်ပြီ ဖြစ်တယ်။
///
/// ★ **တစ်ခါတည်း ဆုံးဖြတ်တယ်** — fps ကောင်းလာလို့ ပြန်မြှင့်, ကျလို့ ပြန်ချ
///   လုပ်ရင် အရည်အသွေးက အပေါ်အောက် ခုန်နေပြီး ပိုဆိုးတယ် (hysteresis
///   မရှိတဲ့ feedback loop)။ ပြန်မြှင့်ချင်ရင် လူကိုယ်တိုင် ခလုတ်နှိပ်ရမယ်။
/// ★ စတင်ချိန်က frame တွေကို ချန်တယ် — shader compile နဲ့ texture upload
///   ကြောင့် ပထမစက္ကန့်က အမြဲ နှေးတယ်၊ အဲဒါကို "စက်ညံ့တယ်" လို့ မမှတ်ရ။

export type Quality = {
  /// frame တိုင်း ခေါ်ပါ။ အရည်အသွေး ချသင့်ပြီဆိုမှ **တစ်ခါတည်း** `true`။
  sample(dt: number): boolean;
  /// လူကိုယ်တိုင် ပြန်မြှင့်လိုက်တဲ့အခါ
  reset(): void;
  readonly fps: number;
};

const TARGET_FPS = 25;
const BAD_SECONDS_LIMIT = 3;
const WARMUP_SECONDS = 2;

export function createQuality(): Quality {
  let bucket = 0; // လက်ရှိ ၁ စက္ကန့် အကွက်ထဲက အချိန်
  let frames = 0;
  let badSeconds = 0;
  let warmup = 0;
  let done = false;
  let fps = 0;

  return {
    get fps() {
      return fps;
    },
    sample(dt) {
      if (warmup < WARMUP_SECONDS) {
        warmup += dt;
        return false;
      }
      bucket += dt;
      frames++;
      if (bucket < 1) return false;

      fps = Math.round(frames / bucket);
      bucket = 0;
      frames = 0;

      if (fps >= TARGET_FPS) {
        badSeconds = 0; // ★ ဆက်တိုက် ဖြစ်မှ ရေတွက်တယ် — ခဏတဖြုတ်
        return false; //   ကျတာက (tab ပြောင်း, GC) စက်ညံ့တာ မဟုတ်ဘူး
      }

      badSeconds++;
      if (badSeconds < BAD_SECONDS_LIMIT || done) return false;
      done = true;
      return true;
    },
    reset() {
      done = false;
      badSeconds = 0;
      warmup = 0;
    },
  };
}
