// ============================================================
// MaeSotRoom.js — မဲဆောက် နယ်စပ်လမ်း (GLB Map Pipeline နမူနာ)
// assets/maesot_block.glb (Blender-style ထုတ်ထားသော GLB) ကို
// MapLoader ဖြင့် load + collision အလိုအလျောက် ထုတ်ထားသည်
// ကိုယ်ပိုင် Blender GLB ဖြင့် အစားထိုးရန် — BLENDER_GUIDE.md ကိုကြည့်ပါ
// ============================================================
import * as THREE from 'three';
import {Room, addRoomLighting } from '../Room.js';
import { addTerrain } from '../Terrain.js';
import { addManor, manorSpot } from '../Kit.js';
import { addBuilding } from '../Buildings.js';
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
    this.ambient = 'city';

    // 🏔️ နယ်စပ် တောင်တန်း — မဲဆောက်က တောင်ကြားထဲက မြို့
    const manor = manorSpot(120);
    addTerrain(this, { ground: 120, palette: 'green', seed: 37, peak: 110, hill: 16,
                       flatSpots: [manor.flatSpot] });
    void addManor(this, { position: manor.position, rotation: manor.rotation });

    // 🛖 နယ်စပ် ရွာ — ခြေတံရှည် ထင်းအိမ်များ (မဲဆောက်ရဲ့ အမှန်တကယ် ပုံစံ)
    //    GLB မြေပုံ (maesot_block.glb) က အလယ်မှာ ရှိလို့ အိမ်တွေကို
    //    ဘေးနှစ်ဖက် လမ်းတစ်လျှောက် ချထားတယ်။
    // ★ x ±၄၀ — လှေကားထစ်တွေက အိမ်ကနေ ၄ m ထွက်နေလို့ ±၃၄ မှာဆို GLB
    //   မြေပုံရဲ့ အဆောက်အအုံနဲ့ ထပ်တယ် (တိုင်းတာပြီး တွေ့ခဲ့)。
    for (const [x, z, rot] of [[-40, -22, Math.PI / 2], [-40, 8, Math.PI / 2],
                               [40, -10, -Math.PI / 2], [40, 20, -Math.PI / 2]]) {
      void addBuilding(this, { kind: 'stilt', position: new THREE.Vector3(x, 0, z), rotation: rot,
        hollow: { side: x < 0 ? '+x' : '-x', width: 4, step: 2.2 } });
    }

    // 🛻 နယ်စပ် ကုန်တင် ပစ်ကပ်များ — လမ်းဘေးမှာ
    for (const [x, z, rot, col] of [
      [-16, 6, Math.PI / 2, 0xb8863b], [-16, 26, Math.PI / 2, 0x2f6f4e],
      [16, -4, -Math.PI / 2, 0xd8324a],
    ]) {
      void addBuilding(this, {
        kind: 'pickup', position: new THREE.Vector3(x, 0, z), rotation: rot,
        paint: { name: 'MAT_Body_Paint', color: col },
      });
    }

    // 🧍‍♀️ ရွာသူ — ထင်းအိမ် ရှေ့မှာ ရပ်နေတယ် (အရိုးမပါတဲ့ ရုပ်မို့ မလျှောက်ဘူး)
    this.addNPC(new NPC({
      name: 'ဒေါ်မြင့်',
      staticBody: '/world/assets/myanmar_woman.glb',
      home: new THREE.Vector3(-26, 0, -20),
      faceYaw: Math.PI / 2,
      dialogue: [
        'မင်္ဂလာပါ — မဲဆောက် နယ်စပ်လမ်းကို ရောက်လာတာ ဝမ်းသာပါတယ်။',
        'ဒီအိမ်တွေက ခြေတံရှည် — မိုးရာသီ ရေကြီးရင် အောက်ကနေ စီးသွားတယ်။',
      ],
    }));

    // 🧍 ရွာသား — ဒေါ်မြင့်နဲ့ ထင်းအိမ် ရှေ့မှာ တွဲရပ် (အရိုးမပါလို့ မလျှောက်)
    this.addNPC(new NPC({
      name: 'ဦးစိုးဝင်း',
      staticBody: '/world/assets/myanmar_man.glb',
      home: new THREE.Vector3(-22, 0, -20),
      faceYaw: Math.PI / 2,
      dialogue: [
        'နယ်စပ်ကို လာလည်တာလား? ကျေးဇူးပါပဲ။',
        'တောင်ဘက် ဂိတ်ကနေ မြဝတီဘက် ကူးလို့ရတယ်၊ မြောက်ဘက်က ရန်ကုန်။',
      ],
    }));

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

    // 🚧 ဂိတ် ← Cyber-Yangon — ရန်ကုန်ဘက် ဂိတ်နဲ့ တွဲထားတယ်၊
    //    ဖြတ်ရင် ဟိုဘက် ဂိတ်ရှေ့မှာပဲ ချတယ် (မြို့လယ် spawn မဟုတ်)。
    this.addPortal({
      position: new THREE.Vector3(0, 0, 16),
      targetRoomId: 'yangon',
      label: 'Cyber-Yangon သို့ပြန်ရန်',
      color: 0x7f5cff,
      gate: 'x',
      // ★ ရန်ကုန် ဂိတ်ရဲ့ **မြောက်ဘက်** ၃ m — တောင်ဘက် (z −18.5…−9.9,
      //   x −23…−8.7) မှာ အမြင့် ၈.၈ m အဆောက်အအုံ ရှိလို့ အဲဒီဘက်မှာ ချရင်
      //   physics က ၃.၇ m ဆွဲထုတ်ပစ်တယ် (တိုင်းစစ်ပြီး)。
      arrive: new THREE.Vector3(-12, 0, -23),
    });

    // 🚕 ဂိတ် → တက္ကစီမြို့ — **ပြန်လာဖို့** ဂိတ်။ တက္ကစီမြို့က ဒီကို
    //    ဂိတ် ချထားပေမယ့် ဒီဘက်မှာ မရှိရင် တစ်ဖက်သွား ဖြစ်နေတယ်။
    this.addPortal({
      position: new THREE.Vector3(12, 0, 10),
      targetRoomId: 'taxi-district',
      label: '🚕 တက္ကစီမြို့သို့',
      color: 0xffd479,
      gate: 'x',
      arrive: new THREE.Vector3(-41, 0, 21),
    });

    // 🌉 နယ်စပ် ဂိတ် → မြဝတီ — မဲဆောက်နဲ့ မြဝတီက ချစ်ကြည်ရေးတံတား
    //    တစ်ဖက်စီပါ။ မြဝတီဘက်က ဂိတ်နဲ့ တွဲထားတယ် (နှစ်ဖက်စလုံး ဖြတ်လို့ရ)。
    this.addPortal({
      position: new THREE.Vector3(0, 0, -22),
      targetRoomId: 'myawaddy',
      label: 'မြဝတီ (မြန်မာ) သို့ — နယ်စပ် ဂိတ်',
      color: 0xffb020,
    });

    this.spawn.set(0, 0, 10);
  }
}
