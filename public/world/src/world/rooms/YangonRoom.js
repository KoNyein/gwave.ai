// ============================================================
// YangonRoom.js — "Cyber-Yangon" ညဈေးတန်း Room
// မြန်မာ့မြို့ပြ + Sci-fi neon ပေါင်းစပ်ထားသော ပင်မ Room
// ============================================================
import * as THREE from 'three';
import { Room } from '../Room.js';
import { NPC } from '../../entities/NPC.js';

export class YangonRoom extends Room {
  constructor() { super('yangon', 'Cyber-Yangon ညဈေးတန်း'); }

  build() {
    // မြေပြင် — မိုးရွာပြီးစ လမ်းမ အနက်ရောင်
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: 0x0d1220, roughness: 0.35, metalness: 0.4 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);
    this.group.add(new THREE.GridHelper(140, 70, 0x1d2a4d, 0x131c36));

    // အလင်းရောင် — ညအလင်း + neon
    this.group.add(new THREE.AmbientLight(0x8899ff, 0.35));
    const moon = new THREE.DirectionalLight(0xaabbff, 0.6);
    moon.position.set(-30, 50, 20); moon.castShadow = true;
    this.group.add(moon);

    // ရွှေရောင် စေတီ (landmark) — ဘယ် room ကနေမဆို မြင်ရအောင် အမြင့်ထား
    const pagoda = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 9, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9a13b, metalness: 0.7, roughness: 0.3 })
    );
    base.position.y = 1.5;
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(6, 16, 8),
      new THREE.MeshStandardMaterial({
        color: 0xf5c542, metalness: 0.85, roughness: 0.2,
        emissive: 0x664400, emissiveIntensity: 0.4
      })
    );
    spire.position.y = 11;
    pagoda.add(base, spire);
    pagoda.position.set(0, 0, -45);
    this.group.add(pagoda);
    pagoda.updateMatrixWorld(true);
    this.addCollider(base); // စေတီအောက်ခြေ — ဖြတ်မထွက်နိုင်
    const pagodaGlow = new THREE.PointLight(0xffcc44, 60, 60);
    pagodaGlow.position.set(0, 14, -45);
    this.group.add(pagodaGlow);

    // ဆိုင်ခန်း/တိုက်တာများ — neon ပြတင်းပေါက်များနှင့်
    const neonColors = [0xff2d78, 0x2de1ff, 0x7f5cff, 0x3ddc97, 0xffb020];
    for (let i = 0; i < 26; i++) {
      const w = 3 + Math.random() * 4, h = 5 + Math.random() * 14, d = 3 + Math.random() * 4;
      const bld = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0x141b30, roughness: 0.8 })
      );
      const side = i % 2 === 0 ? -1 : 1;
      bld.position.set(side * (9 + Math.random() * 22), h / 2, -40 + (i * 3.2));
      bld.castShadow = true;
      this.group.add(bld);
      this.addCollider(bld); // အဆောက်အအုံတိုင်း collision ပါ

      // neon ဆိုင်းဘုတ်
      const neon = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, 0.5, 0.2),
        new THREE.MeshBasicMaterial({ color: neonColors[i % neonColors.length] })
      );
      neon.position.set(bld.position.x, h * 0.7, bld.position.z + d / 2 + 0.15);
      this.group.add(neon);
    }

    // NPC များ — မြန်မာအသိုင်းအဝိုင်း
    this.addNPC(new NPC({
      name: 'ဦးလှ', color: 0xffb020,
      home: new THREE.Vector3(5, 0, -6), range: 7,
      dialogue: [
        'မင်္ဂလာပါ! Gwave Metaverse မှ ကြိုဆိုပါတယ်။',
        'ဒီနေရာက Cyber-Yangon ညဈေးတန်းပါ။',
        'ခရမ်းရောင်တိုင်ကို E နှိပ်ရင် Hydro-Lab ကိုရောက်မယ်။',
        'Wallet ချိတ်ထားရင် နောက်ပိုင်း ဆုတွေရနိုင်မယ်နော်!',
        'လိမ္မော်ရောင်တိုင်က မဲဆောက်၊ အနီရောင်တိုင်က STRIKE Arena!',
      ],
    }));
    this.addNPC(new NPC({
      name: 'မစန်း', color: 0xff2d78,
      home: new THREE.Vector3(-7, 0, -12), range: 6,
      dialogue: [
        'မုန့်ဟင်းခါး စားသွားဦးလေ!',
        'ဒီဈေးတန်းက ညဘက်ဆို လူစည်တယ်။',
        'Three.js နဲ့ဆောက်ထားတာ သိလား? 😄',
      ],
    }));

    // Portal → Hydro-Lab
    this.addPortal({
      position: new THREE.Vector3(12, 0, -20),
      targetRoomId: 'farm',
      label: 'Hydro-Lab (စိုက်ပျိုးရေး Lab) သို့',
      color: 0x7f5cff,
    });

    // Portal → မဲဆောက် (GLB map pipeline)
    this.addPortal({
      position: new THREE.Vector3(-12, 0, -20),
      targetRoomId: 'maesot',
      label: 'မဲဆောက် နယ်စပ်လမ်းသို့',
      color: 0xffb020,
    });

    // Portal → GWAVE STRIKE Arena (FPS)
    this.addPortal({
      position: new THREE.Vector3(0, 0, 16),
      targetRoomId: 'strike',
      label: 'GWAVE STRIKE Arena သို့ (⚔️ FPS)',
      color: 0xd8324a,
    });

    this.spawn.set(0, 0, 8);
  }
}
