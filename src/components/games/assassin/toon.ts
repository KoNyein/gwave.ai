import * as THREE from "three";

/// Assassin — ကာတွန်း (toon) ရုပ်ပုံစနစ်။
///
/// ★ ဒီဇိုင်းလမ်းစဉ် — "ကလေးစာအုပ်ထဲက ရုပ်ပြကာတွန်း": အရောင်နွေးထွေး
///   (neon မဟုတ်)၊ အနားသတ်မျဉ်း ထူထူ၊ အလင်းအမှောင် ၃-၄ ဆင့်တည်း
///   (cel shading)၊ ခေါင်းကြီးကြီး၊ ပုံသဏ္ဌာန် လုံးလုံးဝိုင်းဝိုင်း။
/// ★ Outline က mesh ကို အနည်းငယ်ချဲ့ပြီး **အတွင်းမျက်နှာပြင်ကိုသာ** ပြတာ —
///   post-processing မလိုဘဲ ကာတွန်းဆန်စေတဲ့ အသက်သာဆုံးနည်း။

const DARK = 0x2b2118;
const SKINTONE = 0xf2d0a9;

let gradient: THREE.DataTexture | null = null;

/// Cel shading ရဲ့ အနှစ်သာရ — အလင်းအမှောင်ကို ဆင့်အနည်းငယ်တည်းသာ ခွဲတယ်။
function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const colors = new Uint8Array([90, 160, 225, 255]);
  const tex = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  gradient = tex;
  return tex;
}

export function toonMat(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
}

/// Mesh တစ်ခုအတွက် အနားသတ်မျဉ်း — geometry အတူတူကို ပြန်သုံးလို့ ဈေးပေါတယ်။
function outlineOf(mesh: THREE.Mesh, scale = 1.07): THREE.Mesh {
  const o = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: DARK, side: THREE.BackSide }),
  );
  o.position.copy(mesh.position);
  o.rotation.copy(mesh.rotation);
  o.scale.copy(mesh.scale).multiplyScalar(scale);
  return o;
}

function addWithOutline(parent: THREE.Object3D, mesh: THREE.Mesh, scale = 1.07) {
  parent.add(mesh);
  parent.add(outlineOf(mesh, scale));
  return mesh;
}

/// လက်/ခြေ တစ်ချောင်း — pivot က အဆစ်မှာ ရှိတယ် (အလယ်မှာ မဟုတ်)。
/// ★ Pivot ကို အဆစ်မှာ မထားရင် လှုပ်တဲ့အခါ ခြေထောက်က အလယ်ကနေ လှည့်ပြီး
///   မြေထဲ နစ်သွားမယ်။
function limb(
  parent: THREE.Object3D,
  len: number,
  r: number,
  color: number,
  x: number,
  y: number,
  z: number,
): THREE.Group {
  const joint = new THREE.Group();
  joint.position.set(x, y, z);
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 10);
  const mesh = new THREE.Mesh(geo, toonMat(color));
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  joint.add(mesh);
  const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: DARK, side: THREE.BackSide }));
  o.position.copy(mesh.position);
  o.scale.setScalar(1.09);
  joint.add(o);
  parent.add(joint);
  return joint;
}

export type Fighter = {
  group: THREE.Group;
  /// လမ်းလျှောက် animation အတွက် အဆစ်များ
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  /// လက်နက် ကိုင်ထားတဲ့ နေရာ
  hand: THREE.Group;
  /// ★ ခေါင်းထိမှု စစ်ဖို့ — ဖန်သားပြင်မှာ မမြင်ရဘူး၊ raycast အတွက်သာ
  headHit: THREE.Mesh;
  bodyHit: THREE.Mesh;
};

/// ကာတွန်းလူရုပ် တစ်ယောက်။
///
/// ★ `vest` က **အလှသာ** — မူရင်း prototype မှာ ဒါက `armor > 0.12` နဲ့
///   ချိတ်ထားပြီး ပိုက်ဆံပေးရတဲ့ skin တွေက ကာကွယ်မှု အစစ် ရတယ်။ Gwave မှာ
///   ဆုလာဘ်တွေ cosmetic သာ ဖြစ်ရမယ်ဆိုတာမို့ အသွင်အပြင်ကို ကျန်စေပြီး
///   စွမ်းအားကို ဖယ်ထားတယ် — ဝတ်ထားလို့ ပိုမခံနိုင်ဘူး။
export function createToonFighter(opts: { color: number; vest?: boolean }): Fighter {
  const root = new THREE.Group();
  const C = opts.color;

  const hips = new THREE.Group();
  hips.position.y = 0.86;
  root.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);

  // ကိုယ်လုံး — အပေါ်ကျယ် အောက်ကျဉ်း
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.52, 12), toonMat(C));
  chest.position.y = 0.28;
  chest.castShadow = true;
  addWithOutline(torso, chest);

  if (opts.vest) {
    const vest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.27, 0.36, 12),
      toonMat(0x4a4238),
    );
    vest.position.y = 0.3;
    vest.castShadow = true;
    torso.add(vest);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.06), toonMat(0xd8b26a));
    plate.position.set(0, 0.32, 0.26);
    torso.add(plate);
  }

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), toonMat(0x6b4a2f));
  belt.position.y = 0.02;
  torso.add(belt);

  // ခေါင်း — ကာတွန်းဆန်အောင် ကြီးကြီး
  const neck = new THREE.Group();
  neck.position.y = 0.56;
  torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 16), toonMat(SKINTONE));
  head.position.y = 0.2;
  head.scale.set(1, 1.06, 0.96);
  head.castShadow = true;
  addWithOutline(neck, head);

  // မျက်လုံး — ကာတွန်းရဲ့ အသက်
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    eye.position.set(sx * 0.085, 0.22, 0.2);
    eye.scale.set(1, 1.15, 0.6);
    neck.add(eye);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 10),
      new THREE.MeshBasicMaterial({ color: DARK }),
    );
    pupil.position.set(sx * 0.085, 0.22, 0.245);
    neck.add(pupil);
  }

  // ဆံပင်/ဦးထုပ်
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), toonMat(C));
  cap.position.y = 0.24;
  cap.scale.set(1.02, 0.72, 1.0);
  neck.add(cap);

  const armL = limb(torso, 0.46, 0.075, SKINTONE, -0.31, 0.46, 0);
  const armR = limb(torso, 0.46, 0.075, SKINTONE, 0.31, 0.46, 0);
  const legL = limb(hips, 0.52, 0.095, 0x3f4a55, -0.13, 0.02, 0);
  const legR = limb(hips, 0.52, 0.095, 0x3f4a55, 0.13, 0.02, 0);

  // လက်နက် ကိုင်တဲ့ နေရာ — ညာလက်ဖျားမှာ
  const hand = new THREE.Group();
  hand.position.set(0, -0.44, 0.05);
  armR.add(hand);

  // ★ ထိမှန်မှု စစ်ဖို့ မမြင်ရတဲ့ ပုံသဏ္ဌာန် ၂ ခု — ကာတွန်းရုပ်က အပိုင်း
  //   အများကြီးနဲ့ ဖွဲ့ထားလို့ တစ်ခုချင်း raycast လုပ်ရင် နှေးပြီး ခေါင်း/ကိုယ်
  //   ခွဲရခက်တယ်။
  const headHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  headHit.position.y = 1.62;
  headHit.userData.part = "head";
  root.add(headHit);

  const bodyHit = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.9, 4, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  bodyHit.position.y = 0.78;
  bodyHit.userData.part = "body";
  root.add(bodyHit);

  return { group: root, legL, legR, armL, armR, hand, headHit, bodyHit };
}

/// ကိုင်ထားတဲ့ လက်နက်ရဲ့ ရုပ်ပုံ — ရိုးရှင်းတဲ့ block တွေနဲ့။
export function createWeaponModel(kind: string): THREE.Group {
  const g = new THREE.Group();
  const wood = 0x8a5a3b;
  const dark = 0x2f2620;

  if (kind === "knife") {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), toonMat(wood));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.3), toonMat(0xd6d9dd));
    blade.position.z = 0.2;
    g.add(grip, blade);
  } else if (kind === "sniper") {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.34), toonMat(wood));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), toonMat(dark));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.42;
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), toonMat(0x1c1a18));
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.1, 0.16);
    g.add(stock, barrel, scope);
  } else if (kind === "bomb") {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), toonMat(0x3c4650));
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), toonMat(0xd9b382));
    fuse.position.y = 0.13;
    g.add(ball, fuse);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.26), toonMat(dark));
    body.position.z = 0.08;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), toonMat(0x4a4238));
    grip.position.y = -0.1;
    g.add(body, grip);
  }
  for (const child of [...g.children]) {
    if (child instanceof THREE.Mesh) g.add(outlineOf(child, 1.09));
  }
  return g;
}

/// ကွင်း — မြေ၊ လမ်း၊ အုတ်တံတိုင်း၊ သစ်ပင်။
///
/// ★ အကာအကွယ်တွေက ကွင်းလယ်မှာ စုထားတယ် — ကွင်းက ဗလာဆိုရင် စနိုက်ပါက
///   အားလုံးကို လွှမ်းမိုးပြီး ကျန်တဲ့လက်နက်တွေ အသုံးမဝင်တော့ဘူး။
export function buildArena(scene: THREE.Scene, radius: number) {
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x8a7d5e, 0.85));
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius + 4, 48),
    toonMat(0x8fae72),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ကွင်းအနား — ဒီအပြင် မထွက်ရဘူးဆိုတာ မြင်သာအောင်
  const fence = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.18, 6, 60),
    toonMat(0x6b4a2f),
  );
  fence.rotation.x = -Math.PI / 2;
  fence.position.y = 0.6;
  scene.add(fence);

  const box = (w: number, h: number, d: number, x: number, z: number, color: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color));
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    const o = outlineOf(m, 1.04);
    scene.add(o);
    return m;
  };

  const walls: THREE.Box3[] = [];
  const cover: [number, number, number, number, number, number][] = [
    [6, 2.4, 1.2, 0, -8, 0xc9b08a],
    [1.2, 2.4, 6, -9, 3, 0xc9b08a],
    [1.2, 2.4, 6, 9, 3, 0xc9b08a],
    [5, 1.6, 1.2, -4, 12, 0xb08968],
    [5, 1.6, 1.2, 4, -14, 0xb08968],
    [1.2, 3.2, 5, 14, -6, 0xc9b08a],
    [1.2, 3.2, 5, -14, -6, 0xc9b08a],
  ];
  for (const [w, h, d, x, z, c] of cover) {
    walls.push(new THREE.Box3().setFromObject(box(w, h, d, x, z, c)));
  }

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = radius - 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 7), toonMat(0x6b4a2f));
    trunk.position.set(Math.cos(a) * r, 0.8, Math.sin(a) * r);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), toonMat(0x5f8f4e));
    leaves.position.set(trunk.position.x, 2.2, trunk.position.z);
    leaves.castShadow = true;
    scene.add(leaves);
    scene.add(outlineOf(leaves, 1.05));
  }

  return { walls };
}
