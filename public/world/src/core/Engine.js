// ============================================================
// Engine.js — Gwave Metaverse ၏ အခြေခံ 3D အင်ဂျင် (core)
// Scene + Camera + Renderer + Game Loop ကို တစ်နေရာတည်းမှာ စုစည်းထားသည်
// ============================================================
import * as THREE from 'three';

export class Engine {
  constructor(container = document.body) {
    // Scene = 3D ကမ္ဘာကြီး (အရာအားလုံးထည့်မည့် ဗူးခွံ)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b18);
    this.scene.fog = new THREE.Fog(0x070b18, 45, 170);

    // Camera = ကစားသမား၏ မျက်လုံး
    this.camera = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.1, 600
    );

    // Renderer = Scene ကို မျက်နှာပြင်ပေါ် ပုံဖော်ပေးသည့် စက်
    // 🔋 ဖုန်း CPU/အပူ — pixel ratio 2 ဆိုရင် pixel လေးဆ ပုံဖော်ရတယ်။
    // Touch စက်မှာ 1.5 ကန့်သတ်ရုံနဲ့ shading အလုပ် ~44% ကျတယ်၊ မျက်လုံးနဲ့
    // ကွာခြားချက် မသိသာဘူး။ Antialias/shadow ကိုလည်း ဖုန်းမှာ ပိတ်တယ်။
    const mobile = matchMedia('(hover: none), (max-width: 820px)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'low-power' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

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
      for (const u of this.updatables) u.update?.(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
