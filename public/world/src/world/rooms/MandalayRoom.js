// ============================================================
// MandalayRoom.js — 🏯 **မန္တလေးမြို့** (၂.၄ km × ၂.၄ km)
//
// user: "Mandalay City ကို Yangon cyber နဲ ချိတ် မြဝတီနဲ ချိတ် မဲဆောက်
//        တောင်ကြီး နေပြည်တော် metaverse များနဲ ချိတ်ပါ"
//
// ═══ မော်ဒယ်ကို ဘာလုပ်ထားလဲ ═══
//
// တင်လာတဲ့ဟာက **၂၁ MB / mesh ၆,၈၁၇ / တြိဂံ ၂၇၄,၈၆၂** — အဲဒီအတိုင်း
// ဖုန်းကို ပို့ရင် မဆွဲနိုင်ဘူး။ gltf-transform နဲ့:
//     · `join`     — material အလိုက် ပေါင်း   mesh ၆,၈၁၇ → **၁၀၄**
//     · `simplify` — တြိဂံ ၂၇၄k → **၁၈၃k** (၀.၅၅, အဆောက်အအုံက
//                    ဘောက်စ်ပုံစံမို့ ပုံမပျက်ဘူး)
//     · `quantize` — position/normal/uv ကို bit နည်းနည်းနဲ့
//   ရလဒ်: **၅.၉၄ MB**。
//
// ★ **အရေးအကြီးဆုံး အချက်** — material အလိုက် ပေါင်းလိုက်ရင် mesh တစ်ခုက
//   မြို့တစ်ခုလုံး ဖြစ်သွားပြီး AABB က ၂.၄ km စတုရန်း ဖြစ်တယ်၊ ဒါဆို
//   `MapLoader` က ထုတ်တဲ့ collider က မြို့တစ်ခုလုံးကို ပိတ်ပစ်မယ်။
//   ဒါကြောင့် **ပေါင်းမီ** အဆောက်အအုံ ၃၄၇ လုံးရဲ့ AABB ကို တွက်ပြီး
//   root extras ထဲ သိမ်းထားတယ် — ဒီအခန်းက အဲဒါကို ဖတ်ပြီး collider
//   ထုတ်တယ် (loadCityMap မသုံးဘူး)。
//
// ★ **တောင်တွေက ကြည့်ရုံပဲ** — မန္တလေးတောင် (၁၉၀ m) နဲ့ ပြင်ဦးလွင်
//   ကုန်း (၁၅၀ m) က မော်ဒယ်ရဲ့ TERRAIN အုပ်စုထဲမှာ ရှိတယ်။ အဲဒါတွေရဲ့
//   AABB က ကြီးလွန်းလို့ collider အဖြစ် ထည့်ရင် နံရံကြီး ဖြစ်သွားမယ်။
//   ကြမ်းပြင်က y=၀ ပြားပြားပဲ — တောင်ပေါ် တက်လို့ မရသေးဘူး。
// ============================================================
import * as THREE from 'three';
import { Room, addRoomLighting } from '../Room.js';
import { loadGLB } from '../../core/Assets.js';
import { NPC } from '../../entities/NPC.js';

/// မော်ဒယ်ရဲ့ portal pad ၄ ခု → တကယ်ရှိတဲ့ အခန်းများ
const PAD_TO_ROOM = {
  PORTAL_taxi: { to: 'taxi-district', label: '🚕 တက္ကစီမြို့သို့', arrive: [-40, 0, -21] },
  PORTAL_manor: { to: 'naypyidaw', label: '🏛️ နေပြည်တော် သို့', arrive: [0, 0, 68] },
  PORTAL_colonial: { to: 'yangon', label: '🛕 Cyber-Yangon သို့', arrive: [-26, 0, 0] },
  PORTAL_stilt: { to: 'maesot', label: '🛖 မဲဆောက် သို့', arrive: [-12, 0, 14] },
};

export class MandalayRoom extends Room {
  constructor() {
    super('mandalay', 'မန္တလေးမြို့ (နန်းတော် + မန္တလေးတောင်)');
    this.background = 0x9fc4e0;
    this.spawn.set(0, 0, 560);
  }

  build() {
    addRoomLighting(this, 'day');
    this.ambient = 'city';
    // 🌫️ ၂.၄ km မြို့ — မြူကို ဝေးဝေး ဆွဲမှ တစ်ဖက်စွန်း မြင်ရမယ်
    this.fogNear = 400; this.fogFar = 1150;

    // မြေပြင် — မော်ဒယ်မှာ NOCOL_Ground ပါပေမယ့် အနားလွန်ရင် ဟာမကျန်အောင်
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600),
      new THREE.MeshStandardMaterial({ color: 0x6b6a58, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);

    void loadGLB('/world/assets/mandalay_city.glb').then((gltf) => {
      const city = gltf.scene.clone(true);
      city.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      this.group.add(city);
      city.updateMatrixWorld(true);

      // 🧱 collider — extras ထဲက ဘောက်စ်စာရင်း (ပေါင်းမီ တွက်ထားတာ)。
      //    ★ **scene ရဲ့ extras** မှာ ရှိတယ် — node ပေါ်မှာ မဟုတ်ဘူး။
      //      optimiser ရဲ့ `flatten()` က မြို့ရဲ့ root node ကို ဖျက်ပစ်လို့
      //      node extras က မကျန်ဘူး (ပထမ အကြိမ် collider ၀ ဖြစ်ခဲ့)。
      const ex = gltf.scene.userData || {};
      const list = ex.colliders || [];
      for (const [x0, y0, z0, x1, y1, z1] of list) {
        this.colliders.push(new THREE.Box3(
          new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
      }
      // 🚪 portal pad — မော်ဒယ်က ပေးထားတဲ့ တည်နေရာအတိုင်း
      const marks = ex.marks || {};
      for (const [pad, cfg] of Object.entries(PAD_TO_ROOM)) {
        const at = marks[pad];
        if (!at) continue;
        this.addPortal({
          position: new THREE.Vector3(at[0], 0, at[2]),
          targetRoomId: cfg.to, label: cfg.label, color: 0xffb020,
          gate: Math.abs(at[0]) > Math.abs(at[2]) ? 'z' : 'x',
          arrive: cfg.arrive ? new THREE.Vector3(...cfg.arrive) : null,
        });
      }
      console.log(`🏯 မန္တလေး — collider ${list.length}, portal ${Object.keys(marks).length}`);
    }).catch((e) => console.warn('mandalay_city.glb load မရ:', e));

    // 🚧 ကျန်တဲ့ မြို့ ၂ ခုဆီ — မော်ဒယ်မှာ pad မပါလို့ ကိုယ်တိုင် ချထားတယ်
    this.addPortal({
      position: new THREE.Vector3(0, 0, 600),
      targetRoomId: 'taunggyi',
      label: '🎈 တောင်ကြီး သို့ — ရှမ်းကုန်း လမ်း',
      color: 0x9ad3ff, gate: 'x',
      arrive: new THREE.Vector3(58, 0, 0),
    });
    this.addPortal({
      position: new THREE.Vector3(0, 0, -600),
      targetRoomId: 'myawaddy',
      label: '🌉 မြဝတီ သို့ — အရှေ့တောင် လမ်း',
      color: 0xffd479, gate: 'x',
      arrive: new THREE.Vector3(8, 0, 8),
    });

    // ⛩️ Gwave System — မြို့ဝင်ဝမှာ function kiosk တန်း
    this.addStation({
      position: new THREE.Vector3(-14, 0, 540),
      label: '🛍️ မန္တလေး ဈေးချို — ပစ္စည်း ဝယ်/ရောင်း (GP)',
      action: 'shop', color: 0xf5c542,
    });
    this.addStation({
      position: new THREE.Vector3(14, 0, 540),
      label: '🎯 နန်းတော် လမ်းညွှန် — quest',
      action: 'quests', color: 0x7f5cff,
    });
    this.addStation({
      position: new THREE.Vector3(0, 0, 520),
      label: '🏛️ မန္တလေး အစည်းအဝေးခန်းမ',
      action: 'meet', color: 0x3ddc97,
    });

    this.addNPC(new NPC({
      name: 'ဦးမောင်လွင်', color: 0xf5c542,
      home: new THREE.Vector3(-8, 0, 552), range: 6,
      dialogue: [
        'မန္တလေးကို ကြိုဆိုပါတယ်ဗျာ။',
        'မြောက်ဘက်မှာ နန်းတော် နဲ့ ကျုံး — အနောက်မြောက်မှာ မန္တလေးတောင်။',
        'မြို့က ၂.၄ ကီလို ရှိတယ် — ကား ငှားပြီး လှည့်ကြည့်ပါ။',
      ],
    }));
    this.addNPC(new NPC({
      name: 'ဆရာမ မိုးမိုး', color: 0xff2d78,
      home: new THREE.Vector3(10, 0, 566), range: 6,
      dialogue: [
        'ဒီမှာ ရွှေချ, ကျောက်ဆစ်, ယွန်း လက်မှုပညာ ရှိတယ်ရှင်။',
        'လမ်းအမည်တွေက မြန်မာလို ရေးထားတယ် — ကြည့်လိုက်ပါ။',
      ],
    }));
  }
}
