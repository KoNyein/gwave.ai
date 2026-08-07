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
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.updatables = []; // frame တိုင်း update() ခေါ်ပေးမည့် object များ

    window.addEventListener('resize', () => this.onResize());
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

  start() {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.05); // tab ပြန်ဖွင့်ချိန် ခုန်မသွားအောင်
      for (const u of this.updatables) u.update?.(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
