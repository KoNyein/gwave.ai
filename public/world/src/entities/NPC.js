// ============================================================
// NPC.js — Non-Player Character (AI ဇာတ်ကောင်)
// လွတ်လပ်စွာ လမ်းလျှောက် (wander) + နာမည် label + မြန်မာစကားပြော dialogue
//
// 🧍 **လူ ဖြစ်ရမယ် — တုံး မဖြစ်ရ** (user: "Avatar တွေကို လူထားပါ အတုံးတွေ
//    မထားရ — ဦးလှ၊ မချို စတဲ့ NPC များ")。
//    ဦးလှ၊ မစန်း၊ ဒေါ်စိမ်းလဲ့၊ ကိုမောင်မောင် အားလုံး capsule + ဘောလုံး
//    အဖြစ် ရပ်နေခဲ့တယ်။ အခု နာမည်ကနေ ရုပ်တစ်ခုကို တည်ငြိမ်စွာ ရွေးပြီး
//    (ဝင်တိုင်း တူညီတဲ့ ရုပ်) Locomotion နဲ့ ခြေလှမ်းတယ်။
//    GLB မရရင် capsule နဲ့ ဆက်သွားတယ် — NPC တစ်ယောက် ပျောက်သွားတာထက်
//    တုံးအဖြစ် ရှိနေတာ ပိုကောင်းတယ်။
// ============================================================
import * as THREE from 'three';
import { loadGLB } from '../core/Assets.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { Locomotion } from './Locomotion.js';

/// NPC တွေ ဝတ်မယ့် ရုပ်များ — အမျိုးအစား ကွဲပြားအောင်
const NPC_BODIES = [
  'Character3', 'Character4', 'Character5',
  'Granny', 'Michelle2', 'Clown', 'Remy', 'Xbot',
];

/// နာမည်ကနေ **တည်ငြိမ်တဲ့** ရုပ်ရွေးချယ်မှု — ဦးလှ က ဝင်တိုင်း ဦးလှပဲ။
/// (Math.random() သုံးရင် ဝင်တိုင်း လူပြောင်းသွားပြီး နေရာမကျဘူး)
function bodyFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NPC_BODIES[h % NPC_BODIES.length];
}

export class NPC {
  /**
   * @param o.staticBody — အရိုးမပါတဲ့ GLB လမ်းကြောင်း (ဥပမာ မြန်မာအမျိုးသမီး
   *   ရုပ်)。 ပေးလိုက်ရင် ဒီ NPC က **မလျှောက်ဘူး** — နေရာတကျ ရပ်ပြီး
   *   စကားပြောတယ်။
   *
   *   ★ ဘာလို့ မလျှောက်လဲ — အဲဒီ GLB မှာ bone ၀, skinned mesh ၀,
   *     animation ၀ ပါ။ Locomotion က အရိုးကို လှည့်ပြီး ခြေလှမ်းစေတာ
   *     ဖြစ်လို့ အရိုး မရှိရင် ဘာမှ လှုပ်စရာ မရှိဘူး — အတင်း လျှောက်ခိုင်း
   *     ရင် ရုပ်တုတစ်ခု မြေပြင်ပေါ် **လျှောသွား**နေမယ်။ ဒါကြောင့် ရပ်နေတဲ့
   *     ဇာတ်ကောင် အဖြစ်ပဲ ထားတယ် (ဆိုင်ရှင်၊ ကြိုဆိုသူ စသဖြင့်)。
   */
  constructor({ name, color = 0xf5c542, dialogue = [], home = new THREE.Vector3(),
                range = 8, staticBody = null, faceYaw = 0 }) {
    this.name = name;
    this.dialogue = dialogue;   // စကားပြောစာကြောင်းများ (အလှည့်ကျပြသမည်)
    this.dialogueIndex = 0;
    this.home = home.clone();
    this.staticBody = staticBody;
    this.range = staticBody ? 0 : range;
    this.speed = 1.4;
    this.waitTimer = 0;

    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 6, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );
    body.position.y = 0.95; body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0 })
    );
    head.position.y = 1.75;
    this.placeholder = new THREE.Group();
    this.placeholder.add(body, head);
    this.group.add(this.placeholder, this.makeLabel(name));
    this.group.position.copy(this.home);
    this.pickTarget();

    if (staticBody) {
      // 🧍‍♀️ ရပ်နေတဲ့ ဇာတ်ကောင် — အရိုးမပါလို့ SkeletonUtils မလို၊
      //    Locomotion လည်း မလို။ ရိုးရိုး clone နဲ့ လုံလောက်တယ်။
      this.group.rotation.y = faceYaw;
      void loadGLB(staticBody).then((gltf) => {
        const model = gltf.scene.clone(true);
        model.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
        this.group.add(model);
        this.model = model;
        this.placeholder.visible = false;
      }).catch(() => { /* GLB မရရင် capsule နဲ့ ဆက် */ });
      return;
    }

    // 🧍 တကယ့် ခန္ဓာကိုယ် — မရောက်မချင်း capsule နဲ့ ရပ်နေတယ်
    void loadGLB(`/metaverse/realistic/${bodyFor(name)}.glb`).then((gltf) => {
      const model = cloneSkinned(gltf.scene);
      model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.group.add(model);
      this.model = model;
      this.loco = new Locomotion(model, gltf.animations || []);
      this.placeholder.visible = false;
    }).catch(() => { /* GLB မရရင် capsule နဲ့ ဆက် */ });
  }

  // နာမည်ကို canvas ပေါ်ရေးပြီး Sprite အဖြစ် ခေါင်းပေါ်တင်သည်
  makeLabel(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.font = '52px Padauk, "Myanmar Text", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(7,11,24,.75)';
    const w = ctx.measureText(text).width + 48;
    ctx.beginPath(); ctx.roundRect(256 - w/2, 20, w, 84, 18); ctx.fill();
    ctx.fillStyle = '#f5c542';
    ctx.fillText(text, 256, 82);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), transparent: true, depthTest: false
    }));
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.y = 2.35;
    return sprite;
  }

  pickTarget() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * this.range;
    this.target = new THREE.Vector3(
      this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r
    );
    this.waitTimer = 1 + Math.random() * 3; // ရောက်ရင် ခဏရပ်နားမည်
  }

  nextLine() {
    const line = this.dialogue[this.dialogueIndex % this.dialogue.length];
    this.dialogueIndex++;
    return line;
  }

  update(dt) {
    // 🧍‍♀️ ရပ်နေတဲ့ ဇာတ်ကောင် — ရွေ့စရာ မရှိ၊ frame တိုင်း တွက်စရာလည်း မရှိ
    if (this.staticBody) return;
    const pos = this.group.position;
    const dir = new THREE.Vector3().subVectors(this.target, pos); dir.y = 0;
    const dist = dir.length();
    let moving = false;
    if (dist > 0.3) {
      moving = true;
      dir.normalize();
      pos.addScaledVector(dir, this.speed * dt);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      this.waitTimer -= dt;
      if (this.waitTimer <= 0) this.pickTarget();
    }
    // 🚶 ခြေလှမ်း — ရပ်နေရင် idle, သွားနေရင် လှမ်း
    this.loco?.setMotion({ speed: moving ? this.speed : 0, grounded: true });
    this.loco?.update(dt);
  }
}
