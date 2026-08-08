// ============================================================
// TaxiDistrictRoom.js — 🚕 **တက္ကစီမြို့** (Taxi District)
//
// user: ZIP ထဲက `npc-taxi.glb` — "Taxi District မြို့ အသစ်"
//
// ═══ မော်ဒယ်ကို ဘာလုပ်ထားလဲ ═══
//
// တင်လာတဲ့ ဖိုင်တစ်ခုထဲမှာ **မြို့ကွက် + ကား ၃ စီး + portal pad ၄ ခု**
// အားလုံး ရောနေတယ် (mesh ၄၀၀ ခန့်)。 အဲဒါကို နှစ်ပိုင်း ခွဲထုတ်လိုက်တယ်:
//
//   `taxi.glb`          — ကား တစ်စီး (mesh ၆၀ → ၂၁, ၆၄ KB)。 ဘီး/တံခါး
//                         တွေက ကိုယ်ပိုင် pivot နဲ့ ကျန်နေတယ်၊ ကျန်တာ
//                         material အလိုက် ပေါင်းထားတယ် — ဒါကြောင့်
//                         `addBuilding({ kind: 'taxi' })` နဲ့ **ဘယ်အခန်း
//                         မှာမဆို** ချလို့ရပြီး စီးလို့ရတယ်။
//   `taxi_district.glb` — မြို့ကွက် (mesh ၁၇၇ → ၃၁, ၁၃၇ KB)。 အဆောက်အအုံ
//                         ၁၂ လုံးက `BLD_n` အုပ်စု အသီးသီး ကျန်နေလို့
//                         MapLoader က တစ်လုံးချင်း collider ထုတ်နိုင်တယ်၊
//                         လမ်း/မျဉ်း/လူသွားစင်္ကြံတွေက `NOCOL_` မို့
//                         ဖြတ်လျှောက်လို့ ရတယ်。
//
// ★ ကား ၃ စီးကို မြို့ကွက်ထဲကနေ **ဖယ်ထုတ်ပြီး** အခန်းက ပြန်ချတယ် —
//   GLB ထဲမှာ ပါနေရင် `room.cars` ထဲ ဝင်မလာလို့ E နှိပ်လည်း မစီးရဘူး။
//   အခု နေရာ/ဦးတည်ချက်ကို မူရင်း မော်ဒယ်က တိုင်းယူထားတဲ့ တန်ဖိုးတွေနဲ့
//   အတိအကျ ပြန်ချထားတယ် (ကွင်းပတ်လမ်းပေါ်၊ ဆန့်ကျင်ဘက် ၂ ဖက်)。
//
// ★ ကား မော်ဒယ်ရဲ့ ရှေ့က −Z — `addBuilding` က ၁၈၀° လှည့်ပေးထားလို့
//   ဒီမှာ ပေးရမယ့် rotation က **မူရင်း yaw + π**。
// ============================================================
import * as THREE from 'three';
import { Room, addRoomLighting } from '../Room.js';
import { addBuilding } from '../Buildings.js';
import { loadCityMap } from '../MapLoader.js';
import { NPC } from '../../entities/NPC.js';

/// မူရင်း မော်ဒယ်က တိုင်းယူထားတဲ့ ကား နေရာ/ဦးတည်ချက် (yaw + π ပြီးသား)
const TAXIS = [
  { x: 36.25, z: -12.28, rot: 0 },              // အရှေ့လမ်း — တောင်ဘက်သို့
  { x: -9.13, z: 26.25, rot: -Math.PI / 2 },    // တောင်လမ်း — အနောက်ဘက်သို့
  { x: -28.94, z: -26.25, rot: Math.PI / 2 },   // မြောက်လမ်း — အရှေ့ဘက်သို့
];

/// portal pad ၄ ခု — မော်ဒယ်က နာမည်ပေးထားပေမယ့် ဟိုဘက်မှာ တကယ်
/// ရှိတဲ့ အခန်းနဲ့ ကိုက်အောင် ချိတ်ထားတယ် (pad နာမည်အတိုင်း မဟုတ်)。
const GATES = [
  { x: -47, z: -21, to: 'yangon', label: '🛕 Cyber-Yangon သို့', arrive: [26, 0, 0] },
  { x: -47, z: 21, to: 'maesot', label: '🛖 မဲဆောက် နယ်စပ်လမ်းသို့', arrive: [0, 0, 12] },
  { x: 47, z: -21, to: 'myawaddy', label: '🚧 မြဝတီ သို့', arrive: null },
  { x: 47, z: 21, to: 'farm', label: '🏛️ Gwave Hydro-Lab သို့', arrive: null },
];

export class TaxiDistrictRoom extends Room {
  constructor() {
    super('taxi-district', 'တက္ကစီမြို့ (Taxi District)');
    this.background = 0x9fc4e8;
  }

  build() {
    addRoomLighting(this, 'day');
    this.ambient = 'city';

    // 🗺️ မြို့ကွက် — BLD_* က collider ရ, NOCOL_* က မရ (MapLoader စည်းမျဉ်း)
    loadCityMap(this, '/world/assets/taxi_district.glb')
      .catch(e => console.warn('taxi_district.glb load မရ:', e));

    // 🚕 အငှားကား ၃ စီး — E နဲ့ ဝင်စီးလို့ရတယ်
    for (const t of TAXIS) {
      void addBuilding(this, {
        kind: 'taxi', position: new THREE.Vector3(t.x, 0, t.z), rotation: t.rot,
      });
    }

    // 🚧 ဂိတ် ၄ ခု — ဘေးလေးဖက်က မြို့ကြီးတွေဆီ
    for (const g of GATES) {
      this.addPortal({
        position: new THREE.Vector3(g.x, 0, g.z),
        targetRoomId: g.to, label: g.label, color: 0xffb020,
        gate: 'z',
        arrive: g.arrive ? new THREE.Vector3(...g.arrive) : null,
      });
    }

    // 🧱 မြို့စွန် နံရံ — မြေပြင်က ၁၂၀ × ၁၀၀ ပဲ ရှိတယ်၊ အဲဒီအပြင် ထွက်ရင်
    //    ဘာမှ မရှိတဲ့ ဟာလာဟင်းလင်း ပေါ်မှာ လျှောက်နေရမယ်။
    const RIM = [[0, -52, 130, 2], [0, 52, 130, 2], [-62, 0, 2, 110], [62, 0, 2, 110]];
    for (const [x, z, w, d] of RIM) {
      this.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, 0, z - d / 2),
        new THREE.Vector3(x + w / 2, 12, z + d / 2)
      ));
    }

    // 🧍 NPC — တက္ကစီ ဂိတ်မှူး နဲ့ ခရီးသည်
    this.addNPC(new NPC({
      name: 'ဦးအောင်ကြီး', color: 0xf5c542,
      home: new THREE.Vector3(28, 0, 22), range: 5,
      dialogue: [
        'တက္ကစီမြို့ကို ကြိုဆိုပါတယ်!',
        'ကွင်းပတ်လမ်းပေါ်မှာ ကား ၃ စီး ရပ်ထားတယ် — E နှိပ်ပြီး ကိုယ်တိုင် မောင်းလို့ရတယ်။',
        'အရှေ့နဲ့ အနောက် ဘေးနှစ်ဖက်က ဂိတ်တွေက မြို့ကြီးတွေဆီ သွားတယ်။',
      ],
    }));
    this.addNPC(new NPC({
      name: 'မခင်လှ', color: 0xff2d78,
      home: new THREE.Vector3(-18, 0, 20), range: 6,
      dialogue: [
        'ကားခ က အခြေခံ ၅၀၀ ကျပ်၊ တစ်ကီလိုကို ၄၅၀ ကျပ်တဲ့။',
        'အဆောက်အအုံတွေက အမြင့် ၉ ထပ်တောင် ရှိတယ်နော်။',
      ],
    }));

    // လမ်းဘေး စင်္ကြံပေါ် — ကားလမ်းထဲမှာ မဟုတ်ဘူး
    this.spawn.set(30, 0, 26);
  }
}
