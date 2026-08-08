// ============================================================
// Room.js — Room / Zone အားလုံး၏ မိခင် Class (Base Class)
// Room အသစ်လုပ်လိုလျှင် ဒီ class ကို extend လုပ်ရုံပါပဲ —
// rooms/_TemplateRoom.js ကို ကူးယူ၍ စတင်ပါ
// ============================================================
import * as THREE from 'three';
import { updateDoors } from './Door.js';

export class Room {
  constructor(id, title) {
    this.id = id;         // ဥပမာ 'yangon'
    this.title = title;   // HUD မှာပြမည့် မြန်မာနာမည်
    this.group = new THREE.Group(); // ဒီ room ၏ 3D ပစ္စည်းအားလုံး
    this.npcs = [];       // ဒီ room ထဲက NPC များ
    this.portals = [];    // အခြား room သို့ကူးမည့် တံခါးပေါက်များ
    this.stations = [];   // Function kiosk များ (E နှိပ်လျှင် panel/function ပွင့်)
    this.colliders = [];  // Physics အတွက် Box3 collision box များ
    this.spawn = new THREE.Vector3(0, 0, 6); // ကစားသမား ဝင်ရောက်မည့်နေရာ
    this.cameraMode = 'tps';   // 'tps' (နောက်ကလိုက်ကြည့်) | 'fps' (ပထမလူမြင်ကွင်း)
    /// ⚔️ ဒီအခန်းမှာ လက်နက် ရှိလား — StrikeRoom ကပဲ true。
    /// ★ ဒါက အရေးကြီးတယ်: touch ခလုတ်တန်းက 🔫 ကို **အခန်းတိုင်း**မှာ
    ///   ပြနေတယ်၊ ဒါပေမယ့် StrikeRoom ကလွဲရင် ဘယ်အခန်းမှာမှ weapon မရှိဘူး။
    ///   ဒါကြောင့် ရန်ကုန်/လယ်ကွင်း/မဲဆောက်မှာ 🔫 နှိပ်လည်း ဘာမှ မဖြစ်ဘူး —
    ///   "သေနတ်ပစ်မရဘူး" ဆိုတာ ဒါ။ ခု combat မဟုတ်ရင် ခလုတ်ကို ဖျောက်တယ်။
    this.combat = false;
    this.background = null;    // ဥပမာ 0x7fb7d9 — မထည့်လျှင် မူလညရောင်
    /// 🌫️ မြူ အကွာအဝေး — မထည့်လျှင် မူလ (၅၅ → ၁၉၀)。
    /// အပြင်ဘက် အခန်းတွေမှာ တောင်တန်းက ၂၀၀–၃၈၀ မှာ ရှိလို့ မူလ setting နဲ့ဆို
    /// မြူထဲ လုံးဝ ပျောက်နေတယ် — Terrain.js က ဒါကို ဆွဲထုတ်ပေးတယ်။
    this.fogNear = null;
    this.fogFar = null;
    /// 🎧 ပတ်ဝန်းကျင် အသံ — 'city' | 'sea' | 'wind' | 'none'
    this.ambient = 'none';
    /// 🚪 လှပ်ဖွင့်လို့ရတဲ့ တံခါးများ (Door.js က ထည့်တယ်)
    this.doors = [];
    this.built = false;
  }

  // Room ၏ 3D ကမ္ဘာကို ဒီထဲမှာ တည်ဆောက်ပါ (subclass မှာ override)
  build() {}

  // Room ထဲ ဝင်ချိန်/ထွက်ချိန် hooks (StrikeRoom လို room များအတွက်)
  onEnter(ctx) {}
  onExit(ctx) {}

  addNPC(npc) { this.npcs.push(npc); this.group.add(npc.group); }

  // Mesh တစ်ခုကို collision box အဖြစ် မှတ်ပုံတင်ရန် အတိုကောက်
  addCollider(objOrBox) {
    const box = objOrBox.isBox3
      ? objOrBox
      : new THREE.Box3().setFromObject(objOrBox);
    this.colliders.push(box);
    return box;
  }

  // Portal = ရောင်စဉ်တိုင် — အနီးရောက်ပြီး E နှိပ်လျှင် targetRoomId သို့ကူးမည်
  addPortal({ position, targetRoomId, label, color = 0x7f5cff }) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 3.4, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    mesh.position.copy(position); mesh.position.y = 1.7;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.06, 12, 40),
      new THREE.MeshBasicMaterial({ color })
    );
    ring.rotation.x = Math.PI / 2; ring.position.copy(position); ring.position.y = 0.06;
    this.group.add(mesh, ring);
    this.portals.push({ position: position.clone(), targetRoomId, label, mesh });
  }

  // Station = Function kiosk — အနီးရောက်ပြီး E နှိပ်လျှင် action ပွင့်မည်
  // (portal က room ကူး ၊ station က system function ဖွင့်)
  addStation({ position, label, action, color = 0x2de1ff }) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.4, 1.15, 8),
      new THREE.MeshStandardMaterial({ color: 0x141b30, metalness: 0.7, roughness: 0.3 })
    );
    pillar.position.copy(position); pillar.position.y = 0.575;
    const holo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.7,
        metalness: 0.6, roughness: 0.2, wireframe: true,
      })
    );
    holo.position.copy(position); holo.position.y = 1.55;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.045, 10, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2; ring.position.copy(position); ring.position.y = 0.05;
    this.group.add(pillar, holo, ring);
    this.addCollider(pillar);
    this.stations.push({ position: position.clone(), label, action, holo });
  }

  // frame တိုင်း — NPC + portal effect update
  update(dt, time) {
    updateDoors(this, dt);          // 🚪 ဖွင့်/ပိတ် လှုပ်ရှားမှု
    for (const npc of this.npcs) npc.update(dt);
    for (const p of this.portals) p.mesh.rotation.y = time * 0.8;
    for (const st of this.stations) {
      st.holo.rotation.y = time * 1.2;
      st.holo.position.y = 1.55 + Math.sin(time * 2 + st.position.x) * 0.08;
    }
  }
}

// ============================================================
// 💡 addRoomLighting — အခန်းတိုင်းအတွက် တစ်ခုတည်းသော အလင်း စနစ်
//
// user: "room တွေက အမှောင် အရမ်းများတယ် လင်းတွေ သေချာထည့်ပါ"
//
// အရင်က အခန်းတိုင်းက ambient တစ်ခု + directional တစ်ခုပဲ ထားတယ် —
// အဲဒါက ပုံသဏ္ဌာန်တွေကို ပြားနေစေပြီး အရိပ်ထဲက အရာတွေ လုံးဝ မဲသွားတယ်။
// Hemisphere light က ကောင်းကင်နဲ့ မြေ နှစ်ဘက်ကနေ အလင်းပြန်ပေးလို့ ည
// ခံစားချက် မပျက်ဘဲ မြင်ရတယ် — ambient ကို အတင်း တင်လိုက်တာထက် ကောင်းတယ်။
//
// preset: 'day' | 'night' | 'indoor' | 'neon'
//
// ★ Room ကို ပေးရင် နောက်ခံအရောင်ပါ ချိန်ပေးတယ်။ ဒါ မလုပ်ရင် အလင်း
//   ဘယ်လောက် ထည့်ထည့် WorldManager က နောက်ခံကို မူလ ည အရောင် (0x070b18)
//   နဲ့ ချလိုက်လို့ နေ့ခင်း အခန်းတွေတောင် မဲနေတယ် — STRIKE Arena က
//   အဲဒီအတိုင်း ဖြစ်နေတာ။
// ============================================================
export function addRoomLighting(target, preset = 'day', opts = {}) {
  const room = target && target.group ? target : null;
  const group = room ? room.group : target;
  const P = {
    day:    { sky: 0xbcd7f5, ground: 0x6b6255, hemi: 1.05, amb: 0.45,
              key: 0xfff2d9, keyI: 1.5, fill: 0x9fc0ff, fillI: 0.35, bg: 0x9fc4e8 },
    night:  { sky: 0x5c6ea8, ground: 0x1a2036, hemi: 1.0,  amb: 0.5,
              key: 0xbcc9ff, keyI: 1.15, fill: 0x7f8fd0, fillI: 0.3, bg: 0x0d1428 },
    indoor: { sky: 0xdfe6f2, ground: 0x4a4034, hemi: 0.95, amb: 0.55,
              key: 0xfff0d8, keyI: 1.1, fill: 0xcfd8ff, fillI: 0.4, bg: 0x243044 },
    neon:   { sky: 0x7a5cff, ground: 0x161a2e, hemi: 0.9,  amb: 0.5,
              key: 0xffd9f0, keyI: 1.0, fill: 0x2de1ff, fillI: 0.45, bg: 0x1a1330 },
  }[preset] || {};
  const c = { ...P, ...opts };

  group.add(new THREE.HemisphereLight(c.sky, c.ground, c.hemi));
  group.add(new THREE.AmbientLight(0xffffff, c.amb));

  const key = new THREE.DirectionalLight(c.key, c.keyI);
  key.position.set(-28, 46, 22);
  key.castShadow = true;
  group.add(key);

  // ★ Fill — key ရဲ့ ဆန့်ကျင်ဘက်။ ဒါ မပါရင် အရိပ်ဘက်ခြမ်းက မဲကွက်
  //   ဖြစ်ပြီး ပုံသဏ္ဌာန် လုံးဝ မမြင်ရဘူး။ အရိပ် မချဘူး (ဖုန်း အတွက်)。
  const fill = new THREE.DirectionalLight(c.fill, c.fillI);
  fill.position.set(24, 18, -20);
  group.add(fill);

  // အခန်းက ကိုယ်တိုင် နောက်ခံ မသတ်မှတ်ထားရင် preset ရဲ့ကို သုံး
  if (room && room.background == null) room.background = c.bg;

  return { key, fill, background: c.bg };
}
