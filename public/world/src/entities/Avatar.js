// ============================================================
// Avatar.js — ကစားသမား ဇာတ်ကောင် (TPS + FPS နှစ်မျိုးလုံးရ)
// WASD / Shift ပြေး / Space ခုန် + Collision Physics ချိတ်ဆက်ပြီး
// Room ၏ cameraMode ('tps' | 'fps') အလိုက် အလိုအလျောက် ပြောင်းသည်
// GLB avatar (gwave 3D scanner ထွက်) ကို setModel() ဖြင့် ချိတ်နိုင်သည်
// ============================================================
import * as THREE from 'three';
import { loadGLB } from '../core/Assets.js';
import { EmotePlayer } from './Emotes.js';

const GRAVITY = 22, WALK = 4.2, RUN = 8, JUMP = 8.2;
const RADIUS = 0.4, HEIGHT = 1.8, EYE = 1.6;

export class Avatar {
  constructor(engine, input, physics) {
    this.engine = engine;
    this.input = input;
    this.physics = physics;
    this.mode = 'tps';

    this.group = new THREE.Group();
    this.velY = 0;
    this.grounded = true;
    this.camDist = 6;

    // မူလ placeholder ခန္ဓာကိုယ် (GLB မချိတ်ရသေးလျှင် ဒီအတိုင်းမြင်ရမည်)
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x3ddc97, roughness: 0.5 })
    );
    body.position.y = 0.95; body.castShadow = true;
    this.bodyMat = body.material; // Skin (ဆိုင်ကဝယ်) အရောင်ပြောင်းရန်
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0 })
    );
    head.position.y = 1.75;
    this.headMat = head.material; // Avatar Studio preset အတွက်
    this.placeholder = new THREE.Group();
    this.placeholder.add(body, head);
    this.group.add(this.placeholder);

    this.emotes = new EmotePlayer(this); // 🎭 gesture emotes
    engine.scene.add(this.group);
    engine.register(this);
  }

  // GLB avatar ချိတ်ရန် — ဥပမာ: avatar.setModel('./assets/my_scan.glb')
  async setModel(url) {
    try {
      const gltf = await loadGLB(url);
      this.placeholder.visible = false;
      const model = gltf.scene;
      model.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.group.add(model);
      if (gltf.animations?.length) {
        this.mixer = new THREE.AnimationMixer(model);
        this.mixer.clipAction(gltf.animations[0]).play();
      }
    } catch (e) { console.warn('Avatar GLB မတွေ့ပါ — placeholder ဖြင့်ဆက်သွားမည်', e); }
  }

  // ဆိုင်ကဝယ်ထားသော skin အရောင် — '#f5c542' စသည်
  setSkin(colorHex) {
    if (colorHex) this.bodyMat.color.set(colorHex);
  }

  // 🧬 Avatar Studio preset — body + head အရောင်တွဲ
  applyPreset({ body, head }) {
    if (body) this.bodyMat.color.set(body);
    if (head) this.headMat.color.set(head);
  }

  setMode(mode) {
    this.mode = mode;
    this.group.visible = (mode !== 'fps'); // FPS မှာ ကိုယ်ခန္ဓာဖျောက် (ကင်မရာ=မျက်လုံး)
  }

  teleport(pos) { this.group.position.copy(pos); this.velY = 0; }

  // ကြည့်နေသောဘက် (ရေပြင်ညီ) — ရွေ့လျားမှုနှင့် ကင်မရာ နှစ်ခုလုံး ဒီကိုသုံး
  forward() {
    return { x: -Math.sin(this.input.yaw), z: -Math.cos(this.input.yaw) };
  }

  update(dt) {
    const { input, physics } = this;
    const pos = this.group.position;

    // ၁။ ရွေ့လျားမှု — ကင်မရာကြည့်ရာဘက်နှင့် ကိုက်ညီအောင် forward/right တွက်
    let fw = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    let side = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    if (input.touch) { fw += input.touch.f; side += input.touch.s; } // mobile joystick (analog)
    const mag = Math.min(1, Math.hypot(fw, side));
    if (mag > 0.05) {
      if (this.emotes.current) this.emotes.stop(); // ရွေ့လျားလျှင် emote ရပ်
      const f = this.forward();
      const r = { x: -f.z, z: f.x }; // forward ကို 90° လှည့် = right
      let dx = f.x * fw + r.x * side;
      let dz = f.z * fw + r.z * side;
      const len = Math.hypot(dx, dz); dx /= len; dz /= len;
      // Joystick အပြည့်တွန်း (>0.92) သို့ Shift = ပြေး
      const speed = (input.down('ShiftLeft') || mag > 0.92 ? RUN : WALK) * mag;
      pos.x += dx * speed * dt;
      pos.z += dz * speed * dt;
      this.group.rotation.y = Math.atan2(dx, dz); // သွားရာဘက် မျက်နှာမူ
    }

    // ၂။ Collision — နံရံများမှ တွန်းထုတ်
    physics.resolveHorizontal(pos, RADIUS, HEIGHT);

    // ၃။ ခုန်ခြင်း + ဆွဲငင်အား + box ပေါ်ရပ်ခြင်း
    const groundY = physics.groundHeight(pos, RADIUS);
    if (this.grounded && input.down('Space')) { this.velY = JUMP; this.grounded = false; }
    this.velY -= GRAVITY * dt;
    pos.y += this.velY * dt;
    if (pos.y <= groundY && this.velY <= 0) {
      pos.y = groundY; this.velY = 0; this.grounded = true;
    } else if (pos.y > groundY + 0.02) {
      this.grounded = false;
    }

    this.mixer?.update(dt);
    this.emotes.update(dt);

    // ၄။ ကင်မရာ (intro cinematic ချိန် ပိတ်ထားနိုင်)
    if (this.cameraEnabled === false) return;
    const cam = this.engine.camera;
    if (this.mode === 'fps') {
      const p = input.pitch;
      const f = this.forward();
      cam.position.set(pos.x, pos.y + EYE, pos.z);
      cam.lookAt(
        pos.x + f.x * Math.cos(p),
        pos.y + EYE - Math.sin(p),
        pos.z + f.z * Math.cos(p)
      );
    } else {
      const p = Math.max(-0.35, Math.min(1.1, input.pitch)); // TPS အတွက် ကန့်သတ်
      cam.position.set(
        pos.x + Math.sin(input.yaw) * Math.cos(p) * this.camDist,
        pos.y + EYE + Math.sin(p) * this.camDist,
        pos.z + Math.cos(input.yaw) * Math.cos(p) * this.camDist
      );
      cam.lookAt(pos.x, pos.y + 1.4, pos.z);
    }
  }
}
