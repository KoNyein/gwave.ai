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

  // frame တိုင်း — NPC + portal effect update
  update(dt, time) {
    for (const npc of this.npcs) npc.update(dt);
    for (const p of this.portals) p.mesh.rotation.y = time * 0.8;
  }
}
