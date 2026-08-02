import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/// Bloom — မီးအိမ်, ပြတင်းပေါက်, live screen တွေက ညမှာ တောက်ပလာဖို့။
///
/// ★ **ပိတ်လို့ရရမယ်** ဆိုတာက ရွေးစရာမဟုတ်ဘူး — UnrealBloomPass က
///   မျက်နှာပြင်တစ်ခုလုံးကို ၅ ဆင့် down/up-sample လုပ်တာမို့ GPU အားနည်းတဲ့
///   ဖုန်းအဟောင်းမှာ frame rate ကို ထက်ဝက်နီးပါး ချတယ်။ ပိတ်ထားရင် composer
///   ကို လုံးဝ မဖြတ်ဘဲ renderer.render() ကို တိုက်ရိုက်ခေါ်တယ် — pass
///   တစ်ခုမှ မလည်ဘူး။
/// ★ `setSize` ကို resize မှာ မမေ့ရ — မဟုတ်ရင် window ချဲ့လိုက်တာနဲ့ ပုံက
///   ဆန့်နေမယ် (composer က target အဟောင်းအရွယ်နဲ့ ဆက်ဆွဲနေလို့)။

export type PostFx = {
  enabled: boolean;
  /// ည ဖြစ်လေ bloom များလေ — spec: ည 0.85 / နေ့ 0.35
  setDaylight(day: number): void;
  setSize(w: number, h: number): void;
  render(): void;
  dispose(): void;
};

const BLOOM_DAY = 0.35;
const BLOOM_NIGHT = 0.85;

export function createPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  enabled: boolean,
): PostFx {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    BLOOM_NIGHT,
    0.62, // radius
    // ★ threshold — ဒီတန်ဖိုးအောက် pixel တွေက bloom မဖြစ်ဘူး။ နိမ့်လွန်းရင်
    // မြေပြင်နဲ့ နံရံပါ ဝေဝါးသွားပြီး မြူထဲရောက်နေသလို ဖြစ်တယ်။
    0.72,
  );
  composer.addPass(bloom);
  composer.setSize(width, height);

  const fx: PostFx = {
    enabled,
    setDaylight(day) {
      const d = THREE.MathUtils.clamp(day, 0, 1);
      bloom.strength = BLOOM_NIGHT + (BLOOM_DAY - BLOOM_NIGHT) * d;
    },
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.resolution.set(w, h);
    },
    render() {
      if (fx.enabled) composer.render();
      else renderer.render(scene, camera);
    },
    dispose() {
      bloom.dispose();
      composer.dispose();
    },
  };
  return fx;
}
