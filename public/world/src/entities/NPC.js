// ============================================================
// NPC.js — Non-Player Character (AI ဇာတ်ကောင်)
// လွတ်လပ်စွာ လမ်းလျှောက် (wander) + နာမည် label + မြန်မာစကားပြော dialogue
// GLB model ချိတ်လိုလျှင် Avatar.js ၏ setModel ပုံစံအတိုင်း တိုးချဲ့နိုင်သည်
// ============================================================
import * as THREE from 'three';

export class NPC {
  constructor({ name, color = 0xf5c542, dialogue = [], home = new THREE.Vector3(), range = 8 }) {
    this.name = name;
    this.dialogue = dialogue;   // စကားပြောစာကြောင်းများ (အလှည့်ကျပြသမည်)
    this.dialogueIndex = 0;
    this.home = home.clone();
    this.range = range;
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
    this.group.add(body, head, this.makeLabel(name));
    this.group.position.copy(this.home);
    this.pickTarget();
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
    const pos = this.group.position;
    const dir = new THREE.Vector3().subVectors(this.target, pos); dir.y = 0;
    const dist = dir.length();
    if (dist > 0.3) {
      dir.normalize();
      pos.addScaledVector(dir, this.speed * dt);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      this.waitTimer -= dt;
      if (this.waitTimer <= 0) this.pickTarget();
    }
  }
}
