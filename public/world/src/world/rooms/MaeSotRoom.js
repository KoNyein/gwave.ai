// ============================================================
// MaeSotRoom.js — မဲဆောက် နယ်စပ်လမ်း (GLB Map Pipeline နမူနာ)
// assets/maesot_block.glb (Blender-style ထုတ်ထားသော GLB) ကို
// MapLoader ဖြင့် load + collision အလိုအလျောက် ထုတ်ထားသည်
// ကိုယ်ပိုင် Blender GLB ဖြင့် အစားထိုးရန် — BLENDER_GUIDE.md ကိုကြည့်ပါ
// ============================================================
import * as THREE from 'three';
import {Room, addRoomLighting } from '../Room.js';
import { addTerrain } from '../Terrain.js';
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
    addRoomLighting(this, 'day');

    // 🏔️ နယ်စပ် တောင်တန်း — မဲဆောက်က တောင်ကြားထဲက မြို့
    addTerrain(this, { ground: 120, palette: 'green', seed: 37, peak: 110, hill: 16 });

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
