// ============================================================
// MaeSotRoom.js — မဲဆောက် နယ်စပ်လမ်း (GLB Map Pipeline နမူနာ)
// assets/maesot_block.glb (Blender-style ထုတ်ထားသော GLB) ကို
// MapLoader ဖြင့် load + collision အလိုအလျောက် ထုတ်ထားသည်
// ကိုယ်ပိုင် Blender GLB ဖြင့် အစားထိုးရန် — BLENDER_GUIDE.md ကိုကြည့်ပါ
// ============================================================
import * as THREE from 'three';
import { Room } from '../Room.js';
import { NPC } from '../../entities/NPC.js';
import { loadCityMap } from '../MapLoader.js';

export class MaeSotRoom extends Room {
  constructor() {
    super('maesot', 'မဲဆောက် နယ်စပ်လမ်း');
    this.background = 0x9fc4e0; // နေ့ခင်းကောင်းကင်
  }

  build() {
    // မြေပြင် — နယ်စပ်မြို့ မြေနီလမ်း
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);

    // နေ့ခင်း အလင်း
    this.group.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xfff2d9, 1.4);
    sun.position.set(30, 45, 20); sun.castShadow = true;
    this.group.add(sun);

    // ★ GLB မြို့ကွက် Load — collision များ အလိုအလျောက်ရ ★
    loadCityMap(this, './assets/maesot_block.glb', {
      position: new THREE.Vector3(0, 0, -18),
    }).catch(e => console.warn('maesot_block.glb load မရ:', e));

    // NPC — နယ်စပ်ကုန်သည်
    this.addNPC(new NPC({
      name: 'ကိုမောင်မောင်', color: 0x2d9bf0,
      home: new THREE.Vector3(6, 0, -4), range: 7,
      dialogue: [
        'မဲဆောက်ကို ကြိုဆိုပါတယ်!',
        'ဒီဆိုင်တန်းတွေက Blender နဲ့ဆောက်ပြီး GLB နဲ့ တင်ထားတာ။',
        'နံရံတွေကို တိုးကြည့် — ဖြတ်မထွက်နိုင်တော့ဘူး၊ Collision ပါပြီ။',
        'အမိုးပေါ်လည်း ခုန်တက်လို့ရတယ်နော်!',
      ],
    }));

    // Portal ← Cyber-Yangon
    this.addPortal({
      position: new THREE.Vector3(0, 0, 16),
      targetRoomId: 'yangon',
      label: 'Cyber-Yangon သို့ပြန်ရန်',
      color: 0x7f5cff,
    });

    this.spawn.set(0, 0, 10);
  }
}
