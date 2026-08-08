// ============================================================
// Engine.js — Gwave Metaverse ၏ အခြေခံ 3D အင်ဂျင် (core)
// Scene + Camera + Renderer + Game Loop ကို တစ်နေရာတည်းမှာ စုစည်းထားသည်
// ============================================================
import * as THREE from 'three';
import { onQualityChange, sampleFrame } from './Quality.js';

export class Engine {
  constructor(container = document.body) {
    // Scene = 3D ကမ္ဘာကြီး (အရာအားလုံးထည့်မည့် ဗူးခွံ)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1428);
    this.scene.fog = new THREE.Fog(0x0d1428, 55, 190);

    // Camera = ကစားသမား၏ မျက်လုံး
    this.camera = new THREE.PerspectiveCamera(
      // ★ far ၆၀၀ → ၁၂၅၀ — ရန်ကုန်ကို ၅ဆ ချဲ့တဲ့အခါ တောင်တန်းက ၆၀၀ ကို
      //   ကျော်သွားလို့ မြို့စွန်းကနေ ကြည့်ရင် တောင်တွေ **ဖြတ်တောက်ခံပြီး**
      //   ကောင်းကင်နဲ့ မြေ ကြားမှာ ဟာနေတယ်။ မြူက ၈၀၀+ မှာ ဖုံးထားလို့
      //   ဒီအကွာအဝေးမှာ ဘာမှ ထပ်ရေးစရာ မရှိသလောက်ပဲ။
      70, window.innerWidth / window.innerHeight, 0.1, 1250
    );

    // Renderer = Scene ကို မျက်နှာပြင်ပေါ် ပုံဖော်ပေးသည့် စက်
    // 🔋 ဖုန်း CPU/အပူ — pixel ratio 2 ဆိုရင် pixel လေးဆ ပုံဖော်ရတယ်။
    // Touch စက်မှာ 1.5 ကန့်သတ်ရုံနဲ့ shading အလုပ် ~44% ကျတယ်၊ မျက်လုံးနဲ့
    // ကွာခြားချက် မသိသာဘူး။ Antialias/shadow ကိုလည်း ဖုန်းမှာ ပိတ်တယ်။
    const mobile = matchMedia('(hover: none), (max-width: 820px)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'low-power' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this._maxRatio = mobile ? 1.5 : 2;
    // 🎚️ ဂရပ်ဖစ် အဆင့် — pixelRatio က အထိရောက်ဆုံး လက်နက်။ 1.5 → 1.0
    //    ဆိုရင် shading လုပ်ရမယ့် pixel ၅၆% လျော့တယ်။
    onQualityChange((lv) => {
      const cap = lv === 'low' ? 1 : lv === 'mid' ? 1.25 : this._maxRatio;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
    });
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 🌗 Tone mapping — မထည့်ရင် linear→sRGB အတိအကျ ဖြစ်ပြီး ညအလင်း
    //    နည်းတဲ့ scene တွေက မဲတောင့်တောင့် ဖြစ်တယ် (user: "Cyber-Yangon
    //    room က အရမ်း မှောင်လွန်းတယ်")。 ACES က အမှောင်ပိုင်းကို ဆွဲတင်ပြီး
    //    neon အလင်းတွေ မလျှံစေဘူး — ညရဲ့ ခံစားချက် မပျက်ဘဲ မြင်ရတယ်။
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // ★ ဖန်သားပြင် အလင်း — ဖုန်းတစ်လုံးနဲ့တစ်လုံး၊ နေရောင်အောက်နဲ့ အိမ်ထဲ
    //   အရမ်း ကွာတယ်။ ဒါကြောင့် user ကိုယ်တိုင် ချိန်လို့ရအောင် ထားပြီး
    //   ရွေးချယ်မှုကို သိမ်းတယ် (🔆 ခလုတ်)。
    this.exposureSteps = [1.0, 1.25, 1.6, 2.0];
    let saved = 1;
    try { saved = Number(localStorage.getItem('gw.world.exposure')) || 1; } catch { /* private */ }
    this.exposureIdx = Math.max(0, Math.min(this.exposureSteps.length - 1, saved));
    this.renderer.toneMappingExposure = this.exposureSteps[this.exposureIdx];
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.updatables = []; // frame တိုင်း update() ခေါ်ပေးမည့် object များ
    /// ⏸ Render loop ရပ်ထားလား — tab မမြင်ရတော့တာ ဒါမှမဟုတ် overlay
    /// (Live/Games/Shop) ဖုံးထားချိန် 3D ကို ဆက်မပုံဖော်ဘူး။ ဒါက ဖုန်း
    /// ပူတာ/battery ကုန်တာရဲ့ အဓိက အကြောင်းရင်း ဖြစ်ခဲ့တယ်။
    this.paused = false;
    this._blockers = 0;

    window.addEventListener('resize', () => this.onResize());
    // Tab/app နောက်ကွယ် ရောက်ရင် ချက်ချင်း ရပ် — ပြန်ပေါ်မှ ဆက်
    document.addEventListener('visibilitychange', () =>
      this.setPaused(document.hidden, 'hidden'));
  }

  /// 🔆 အလင်း တစ်ဆင့် တိုး — အဆုံးရောက်ရင် အစကို ပြန်လှည့်
  cycleExposure() {
    this.exposureIdx = (this.exposureIdx + 1) % this.exposureSteps.length;
    this.renderer.toneMappingExposure = this.exposureSteps[this.exposureIdx];
    try { localStorage.setItem('gw.world.exposure', String(this.exposureIdx)); } catch { /* private */ }
    return this.exposureSteps[this.exposureIdx];
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /// လက်ရှိ pixelRatio — headless စမ်းသပ်မှုက ဒါကို တိုင်းတယ်
  get pixelRatio() { return this.renderer.getPixelRatio(); }

  // update(dt) function ပါသော object တစ်ခုကို loop ထဲ ထည့်ရန်
  register(obj) { this.updatables.push(obj); }
  unregister(obj) {
    const i = this.updatables.indexOf(obj);
    if (i >= 0) this.updatables.splice(i, 1);
  }

  /// Overlay ဖွင့်/ပိတ်ချိန် ခေါ် — blocker ရှိသမျှ render မလုပ်ဘူး
  setPaused(on, _reason) {
    this._blockers = Math.max(0, this._blockers + (on ? 1 : -1));
    this.paused = this._blockers > 0;
    if (!this.paused) this.clock.getDelta(); // ရပ်နေချိန် dt မစုစေရ
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      if (this.paused) return; // ⏸ frame တစ်ခုမှ မပုံဖော်ဘူး
      const dt = Math.min(this.clock.getDelta(), 0.05); // tab ပြန်ဖွင့်ချိန် ခုန်မသွားအောင်
      sampleFrame(dt);   // 🎚️ အလို ဂရပ်ဖစ် — FPS တိုင်းပြီး အဆင့် ချိန်တယ်
      for (const u of this.updatables) u.update?.(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
