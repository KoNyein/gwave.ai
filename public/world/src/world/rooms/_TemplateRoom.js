// ============================================================
// _TemplateRoom.js — Room အသစ်လုပ်ရန် နမူနာပုံစံ (ဒီဖိုင်ကို ကူးယူပါ)
// ၁) ဖိုင်နာမည်ပြောင်း (ဥပမာ MandalayRoom.js)
// ၂) class နာမည် + id + title ပြောင်း
// ၃) build() ထဲမှာ ကိုယ့် 3D ကမ္ဘာ တည်ဆောက်
// ၄) main.js မှာ import + world.register() လုပ်
// ============================================================
import * as THREE from 'three';
import { Room } from '../Room.js';
import { NPC } from '../../entities/NPC.js';

export class TemplateRoom extends Room {
  constructor() { super('template', 'နမူနာ Room'); }

  build() {
    // မြေပြင်
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x223311 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);

    // အလင်းရောင် (မထည့်လျှင် အမည်းရောင်သာ မြင်ရမည်)
    this.group.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(20, 30, 10); sun.castShadow = true;
    this.group.add(sun);

    // NPC နမူနာ
    this.addNPC(new NPC({
      name: 'ကိုနမူနာ',
      home: new THREE.Vector3(4, 0, -4),
      dialogue: ['မင်္ဂလာပါ!', 'ဒါ Room Template ပါ။'],
    }));

    // Portal နမူနာ — 'yangon' room သို့ပြန်ကူးရန်
    this.addPortal({
      position: new THREE.Vector3(0, 0, -10),
      targetRoomId: 'yangon',
      label: 'Cyber-Yangon သို့',
    });
  }
}
