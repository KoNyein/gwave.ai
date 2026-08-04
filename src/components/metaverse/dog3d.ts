import * as THREE from "three";
import type { Avatar, HumanState } from "./human";

/// 🐕 NPC ခွေး — procedural low-poly model။
///
/// ★ `Avatar` interface ကို **အပြည့်** လိုက်နာတယ် — ဒါမှ remotes pipeline
///   (lerp/nametag/dispose) က လူသားနဲ့ ခွေး ခွဲစရာမလိုဘဲ တစ်လမ်းတည်း
///   သွားတယ်။ attach point တွေက structure အတွက်ပဲ — ခွေးမှာ ဦးထုပ်/
///   လက်နက် မတပ်ဘူး (handR က ဗလာ group)။
/// ★ Human နဲ့ material ၃ မျိုး convention တူတယ် — skin=အမွေး၊
///   cloth=လည်ပတ်ကြိုး၊ dark=နှာခေါင်း/ခြေဖျား — draw call နည်းနည်းပဲ။

export function createDog(furColor = 0x4a3826, collarColor = 0xc0392b): Avatar {
  const group = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: collarColor, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 0.85 });

  // ── ကိုယ်ထည် — root → body → { head(+နား/နှာ), ခြေ ၄ ချောင်း, အမြီး } ──
  const body = new THREE.Group();
  body.position.y = 0.42;
  group.add(body);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.62), skin);
  body.add(torsoMesh);
  // လည်ပတ်ကြိုး — ခင်လို့ရတဲ့ ခွေးမှန်း မြင်သာအောင်
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.07, 0.12), cloth);
  collar.position.set(0, 0.06, 0.28);
  body.add(collar);

  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.38);
  body.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.26), skin));
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.16), skin);
  snout.position.set(0, -0.04, 0.19);
  head.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), dark);
  nose.position.set(0, -0.02, 0.28);
  head.add(nose);
  const gEar = new THREE.BoxGeometry(0.06, 0.12, 0.04);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(gEar, dark);
    ear.position.set(sx * 0.08, 0.16, -0.02);
    ear.rotation.z = sx * -0.2;
    head.add(ear);
  }

  // ခြေထောက် ၄ ချောင်း — pivot က ပေါင်ရင်းမှာ (လွှဲရင် သဘာဝကျအောင်)
  const gLeg = new THREE.BoxGeometry(0.09, 0.34, 0.09);
  const gPaw = new THREE.BoxGeometry(0.1, 0.06, 0.12);
  const legs: THREE.Group[] = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.12, -0.13, sz * 0.22);
    const legMesh = new THREE.Mesh(gLeg, skin);
    legMesh.position.y = -0.17;
    leg.add(legMesh);
    const paw = new THREE.Mesh(gPaw, dark);
    paw.position.set(0, -0.32, 0.02);
    leg.add(paw);
    body.add(leg);
    legs.push(leg);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.12, -0.32);
  const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), skin);
  tailMesh.position.z = -0.12;
  tail.add(tailMesh);
  tail.rotation.x = 0.6;
  body.add(tail);

  // Avatar interface အတွက် attach point များ — ခွေးမှာ အမှန်တကယ် သုံးတာက
  // head (nametag အမြင့်ခန့်မှန်း) ပဲ၊ ကျန်တာ structure ပြည့်ဖို့။
  const handR = new THREE.Group();
  body.add(handR);

  let walkT = 0;
  let wagT = 0;

  function update(dt: number, state: HumanState) {
    const speed = state.speed;
    walkT += dt * (2.2 + speed * 1.6);
    wagT += dt * 6;
    // ခြေ ၄ ချောင်း — ထောင့်ဖြတ်အတွဲ (diagonal gait): ရှေ့ဘယ်+နောက်ညာ တွဲ
    const amp = Math.min(0.65, speed * 0.16);
    for (let i = 0; i < legs.length; i++) {
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      legs[i]!.rotation.x = Math.sin(walkT + phase) * amp;
    }
    // အမြီးလှုပ် — အမြဲနည်းနည်း၊ ပြေးရင် ပိုမြန်
    tail.rotation.z = Math.sin(wagT) * 0.35;
    // ပြေးရင် ကိုယ်ထည် အနည်းငယ် နိမ့်မြင့် (gallop feel)
    body.position.y = 0.42 + (speed > 0.1 ? Math.abs(Math.sin(walkT)) * 0.035 : 0);
  }

  function dispose() {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    skin.dispose();
    cloth.dispose();
    dark.dispose();
  }

  return {
    group,
    attach: { head, torso: body, hips: body, footL: legs[0]!, footR: legs[1]!, handR },
    attachments: [],
    materials: { skin, cloth, dark },
    update,
    dispose,
  };
}
