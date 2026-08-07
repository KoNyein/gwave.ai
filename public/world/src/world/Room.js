// ============================================================
// Room.js — Room / Zone အားလုံး၏ မိခင် Class (Base Class)
// Room အသစ်လုပ်လိုလျှင် ဒီ class ကို extend လုပ်ရုံပါပဲ —
// rooms/_TemplateRoom.js ကို ကူးယူ၍ စတင်ပါ
// ============================================================
import * as THREE from 'three';

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
    this.background = null;    // ဥပမာ 0x7fb7d9 — မထည့်လျှင် မူလညရောင်
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
    for (const npc of this.npcs) npc.update(dt);
    for (const p of this.portals) p.mesh.rotation.y = time * 0.8;
    for (const st of this.stations) {
      st.holo.rotation.y = time * 1.2;
      st.holo.position.y = 1.55 + Math.sin(time * 2 + st.position.x) * 0.08;
    }
  }
}
