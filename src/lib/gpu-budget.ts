/**
 * 🔋 3D renderer တွေအတွက် **တစ်နေရာတည်းက GPU budget**。
 *
 * Gwave မှာ three.js canvas ၁၀ ခုကျော် ရှိတယ် (metaverse, arcade, arena,
 * assassin, drone, fpv, avatar preview, movement lab, scanner …)。 တစ်ခုချင်း
 * ကိုယ့်နည်းကိုယ့်ဟန်နဲ့ pixel ratio 2 / antialias / shadow ဖွင့်ထားလို့
 * ဖုန်းမှာ တစ်ခုစီက GPU ကို အပြည့် တောင်းတယ် — အဲဒါက ဖုန်း ပူတဲ့ အကြောင်း。
 *
 * ★ pixel ratio 2 → 1.5 ဆိုတာ shading အလုပ် **~44% ကျ** (2² = 4 vs 1.5² =
 *   2.25)。 မျက်လုံးနဲ့ ကွာခြားချက် မသိသာဘူး။
 * ★ antialias + shadow map က ဖုန်း GPU မှာ အသက်ကုန်ဆုံး နှစ်ခု — touch
 *   စက်မှာ ပိတ်တယ်။
 */

export const isMobileGpu = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: none), (max-width: 820px)").matches;

type BudgetableRenderer = {
  setPixelRatio: (r: number) => void;
  shadowMap: { enabled: boolean };
};

/**
 * Renderer တစ်ခုကို စက်အလိုက် ကန့်သတ်ပေးတယ်။ `maxDesktop` က desktop မှာ
 * ခွင့်ပြုမယ့် အမြင့်ဆုံး pixel ratio (default 2)。
 */
export function applyGpuBudget(
  renderer: BudgetableRenderer,
  opts?: { maxDesktop?: number; shadows?: boolean },
) {
  const mobile = isMobileGpu();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  renderer.setPixelRatio(Math.min(dpr, mobile ? 1.5 : (opts?.maxDesktop ?? 2)));
  renderer.shadowMap.enabled = (opts?.shadows ?? true) && !mobile;
  return mobile;
}

/**
 * `new THREE.WebGLRenderer(gpuRendererOptions())` — ဖုန်းမှာ antialias ပိတ်ပြီး
 * low-power GPU ကို တောင်းတယ်။ (extra ထဲက key တွေ အတိုင်း ထပ်ဖြည့်လို့ရ)
 */
export function gpuRendererOptions<T extends Record<string, unknown>>(extra?: T) {
  const mobile = isMobileGpu();
  return {
    ...(extra ?? ({} as T)),
    antialias: !mobile,
    powerPreference: mobile ? "low-power" : "high-performance",
  } as T & { antialias: boolean; powerPreference: "low-power" | "high-performance" };
}
