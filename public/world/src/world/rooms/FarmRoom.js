// ============================================================
// FarmRoom.js — "Hydro-Lab" Smart Farm Room
// Gwave ၏ hydroponic စိုက်ပျိုးရေး နည်းပညာကို ဂိမ်းထဲ သွင်းထားသော Room
// ============================================================
import * as THREE from 'three';
import {Room, addRoomLighting } from '../Room.js';
import { addTerrain } from '../Terrain.js';
import { addBuilding } from '../Buildings.js';
import { NPC } from '../../entities/NPC.js';

export class FarmRoom extends Room {
  constructor() { super('farm', 'Gwave Hydro-Lab'); }

  build() {
    // Lab ကြမ်းပြင် — သန့်ရှင်းသော အဖြူ/မီးခိုး
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.4 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);

    // Lab အလင်း — စိုက်ပျိုးရေးမီး ပန်းရောင်ခပ်ခပ် (grow lights)
    // 💡 အလင်း စနစ် — Room.js ရဲ့ တစ်ခုတည်းသော preset (hemisphere+key+fill)
    addRoomLighting(this, 'indoor');

    // 🏔️ စိုက်ခင်းကို ဝိုင်းထားတဲ့ စိမ်းလန်းချိုင့်ဝှမ်း — တောင် နိမ့်နိမ့်
    addTerrain(this, { ground: 90, palette: 'lush', seed: 23, peak: 62, hill: 10 });

    // 🏠 စိုက်ခင်း အိမ် — ကွင်းစွန်းက ထင်းအိမ် (lab ရဲ့ တာဝန်ခံ နေတဲ့ အိမ်)
    void addBuilding(this, {
      kind: 'stilt', position: new THREE.Vector3(-30, 0, -26), rotation: Math.PI / 3,
    });

    // 🛻 စိုက်ခင်း ကုန်တင်ကား — အိမ်ဘေးမှာ ရပ်ထား
    void addBuilding(this, {
      // ★ အိမ်ရဲ့ AABB က x -၄၃.၇…-၁၆.၃ ဖြစ်လို့ x -၁၆ မှာ ထားရင်
      //   အိမ်ထဲ ဝင်နေတယ် (တိုင်းတာပြီး တွေ့ခဲ့)。 အိမ်ဘေး ထွက်ထားတယ်။
      kind: 'pickup', position: new THREE.Vector3(-9, 0, -30), rotation: Math.PI / 5,
      paint: { name: 'MAT_Body_Paint', color: 0x4a7c3a },
    });

    // 🧍‍♀️ စိုက်ခင်း တာဝန်ခံ — အိမ်ရှေ့မှာ ရပ်နေတယ်
    this.addNPC(new NPC({
      name: 'မခင်လှ',
      staticBody: '/world/assets/myanmar_woman.glb',
      home: new THREE.Vector3(-22, 0, -20),
      faceYaw: -Math.PI / 3,
      dialogue: [
        'ဒီက ရေမြေဆီ စိုက်ခင်း lab ပါ — မြေမလိုဘဲ စိုက်လို့ရတယ်။',
        'အပင်တွေက ရေထဲကနေ အာဟာရ တိုက်ရိုက် ယူတယ် ရှင့်။',
      ],
    }));

    // Hydroponic စင်တန်းများ — စင် + အပင်စိမ်းလေးများ
    const plantMat = new THREE.MeshStandardMaterial({
      color: 0x3ddc97, emissive: 0x0a3d26, emissiveIntensity: 0.4
    });
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x9aa7bd, metalness: 0.8, roughness: 0.3 });
    for (let row = 0; row < 4; row++) {
      for (let level = 0; level < 3; level++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 1.6), rackMat);
        shelf.position.set(0, 0.8 + level * 1.1, -6 - row * 4);
        this.group.add(shelf);
        for (let p = 0; p < 9; p++) {
          const plant = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 6), plantMat);
          plant.position.set(-8 + p * 2, 1.25 + level * 1.1, -6 - row * 4);
          this.group.add(plant);
        }
      }
    }

    // ဗဟို data sculpture — Network Node Hub အငွေ့အသက်
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.6, 1),
      new THREE.MeshStandardMaterial({
        color: 0x2de1ff, emissive: 0x0a4b5c, emissiveIntensity: 0.8,
        metalness: 0.9, roughness: 0.15, wireframe: true
      })
    );
    core.position.set(0, 3.4, 8);
    this.group.add(core);
    this.core = core;
    const coreLight = new THREE.PointLight(0x2de1ff, 40, 30);
    coreLight.position.copy(core.position);
    this.group.add(coreLight);

    // NPC — စိုက်ပျိုးရေး ပညာရှင်
    this.addNPC(new NPC({
      name: 'ဒေါ်စိမ်းလဲ့', color: 0x3ddc97,
      home: new THREE.Vector3(-4, 0, -8), range: 6,
      dialogue: [
        'ဒီမှာ ရေနဲ့ပဲ စိုက်တာ — မြေမလိုဘူး၊ Hydroponics လို့ခေါ်တယ်။',
        'Sensor တွေက အပူချိန်နဲ့ PH ကို ၂၄ နာရီ စောင့်ကြည့်နေတယ်။',
        'လက်တွေ့ Gwave Smart Farm မှာလည်း ဒီစနစ်အတိုင်းပဲ အလုပ်လုပ်တယ်။',
      ],
    }));

    // Portal ← Cyber-Yangon ပြန်သွားရန်
    this.addPortal({
      position: new THREE.Vector3(0, 0, 16),
      targetRoomId: 'yangon',
      label: 'Cyber-Yangon သို့ပြန်ရန်',
      color: 0xffb020,
    });

    this.spawn.set(0, 0, 12);
  }

  update(dt, time) {
    super.update(dt, time);
    if (this.core) { this.core.rotation.y = time * 0.5; this.core.rotation.x = time * 0.2; }
  }
}
