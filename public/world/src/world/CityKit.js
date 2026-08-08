// ============================================================
// CityKit.js — မြို့တွေ ဆောက်ဖို့ **ပြန်သုံးလို့ရတဲ့ အစိတ်အပိုင်းများ**
//
// user: "Metaverse ထဲမှာ မြို့တွေ ဆောက်မယ် — မြဝတီ, ဘုရားသုံးဆူ,
//        မဲဆောက်, ချင်းမိုင်, ဘန်ကောက်, ဖူးခက် … NPC များ ထည့်ပါ"
// user: "သုံးမရတဲ့ အတွင်းသွားလို့မရတဲ့ တိုက်တွေ အကုန် ဖယ်ပါ"
//
// ═══ အရေးအကြီးဆုံး စည်းမျဉ်း ═══
//
// **သေတ္တာတုံး မဆောက်ရ**。 ဒီဖိုင်ထဲက အဆောက်အအုံတိုင်းမှာ:
//   · ကြမ်းပြင် ရှိတယ် (ဝင်ရင် ခြေထောက် အောက်မှာ ခံမယ့်အရာ)
//   · နံရံ ၄ ဘက် ရှိတယ် — ဒါပေမယ့် **ရှေ့နံရံမှာ တံခါးဝ ချန်ထားတယ်**
//   · collider က နံရံအလိုက် — တံခါးဝမှာ collider **မရှိ**လို့ ဝင်လို့ရတယ်
//
// ★ ဘောက်စ်တစ်ခုတည်းနဲ့ အဆောက်အအုံ တစ်လုံးလုံးကို ဖုံးလိုက်ရင်
//   "အထဲ ဟာပြီး တံခါး ပါတယ်" ဆိုတာကို **ဘယ်တော့မှ ဖော်ပြလို့ မရဘူး** —
//   ဒါက GLB အိမ်တွေ ဝင်မရဖြစ်ရတဲ့ အကြောင်းရင်း ဖြစ်ခဲ့တယ်။ ဒီမှာ
//   နံရံတစ်ချပ်ချင်း collider လုပ်တယ်၊ တံခါးဝကို ချန်ထားတယ်။
//
// 🔋 ဖုန်း — အဆောက်အအုံ တစ်လုံးက mesh ~၁၀, တြိဂံ ~၃၀၀ ပဲ။ texture မရှိ၊
//    ဖိုင် မဆွဲရဘူး၊ frame တိုင်း အလုပ် မရှိဘူး။
// ============================================================

import * as THREE from 'three';

/// material တွေကို **မျှသုံး**တယ် — အဆောက်အအုံ ၅၀ လုံးဆိုရင် material
/// ၅၀ ခု ဆောက်စရာ မလိုဘူး (shader ပြန်တည်ဆောက်ရတာ ကုန်ကျတယ်)。
const cache = new Map();
function mat(hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.85, ...opts,
    }));
  }
  return cache.get(key);
}

/// box တစ်ခု ဆောက် + (လိုရင်) collider အဖြစ် **မှတ်ထား**
///
/// ⚠️ collider ကို ဒီမှာ **မတွက်ရ**。 ဒီအချိန်မှာ ခေါင်းစဉ် group က
///    မြေပြင်ပေါ် နေရာ မချရသေးဘူး (နောက်ဆုံးမှ `place()` က ချတယ်)。
///    အဲဒီအချိန် `setFromObject` လုပ်ရင် **origin မှာ** box ထွက်လာပြီး
///    အဆောက်အအုံက ဘာမှ မတားတော့ဘူး — တစ်ခါ ဖြစ်ခဲ့ပြီး ဇယားကွက်
///    တိုင်းတာမှ တွေ့ခဲ့တာ (နံရံ ၁၃×၁၃ m အတွင်း တားတာ သုည)。
///    ဒါကြောင့် mesh ကို စာရင်းသွင်းထားပြီး `place()` မှာမှ တွက်တယ်။
function slab(bag, group, { x, y, z, w, h, d, colour, collide = true, rotY = 0 }) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(colour));
  m.position.set(x, y + h / 2, z);
  if (rotY) m.rotation.y = rotY;
  group.add(m);
  if (collide && bag) bag.push(m);
  return m;
}

/// အဆောက်အအုံကို မြေပြင်ပေါ် ချ → world matrix update → collider တွက်
function place(room, g, { x, z, rot, bag }) {
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  room.group.add(g);
  g.updateMatrixWorld(true);
  for (const m of bag) room.colliders.push(new THREE.Box3().setFromObject(m));
  return g;
}

/**
 * 🏪 ဆိုင်ခန်းတိုက် — အရှေ့တောင်အာရှ ပုံစံ shophouse。 **ဝင်လို့ရတယ်**。
 *
 * ရှေ့နံရံကို ဘယ်/ညာ နှစ်ပိုင်း ခွဲပြီး အလယ်မှာ တံခါးဝ (၂.၂ m) ချန်တယ်။
 * အဲဒီ ချန်ထားတဲ့ နေရာမှာ collider မရှိလို့ လျှောက်ဝင်လို့ ရတယ်။
 *
 * @param o.rot — ရှေ့မျက်နှာ ဘယ်ဘက်လှည့်မလဲ (radian)。 ၀ = +Z ဘက် မျက်နှာမူ
 */
export function shophouse(room, {
  x = 0, z = 0, rot = 0, w = 8, d = 8, h = 6,
  wall = 0xd9cdb5, roof = 0x8c3b2e, trim = 0x3f4a5a, storeys = 2,
} = {}) {
  const g = new THREE.Group();
  const bag = [];                 // collider ဖြစ်မယ့် mesh များ
  const t = 0.35;                 // နံရံ ထူ
  const door = 2.2;               // တံခါးဝ အကျယ်
  const side = (w - door) / 2;    // ရှေ့နံရံ တစ်ဘက်စီ အလျား

  // ကြမ်းပြင် — ဝင်ရင် နင်းစရာ (နိမ့်လို့ ကျော်တက်စရာ မလို)
  slab(null, g, { x: 0, y: -0.05, z: 0, w, h: 0.1, d, colour: 0x9c9689, collide: false });

  // နောက်နံရံ + ဘေးနံရံ ၂ ဘက်
  slab(bag, g, { x: 0, y: 0, z: -d / 2 + t / 2, w, h, d: t, colour: wall });
  slab(bag, g, { x: -w / 2 + t / 2, y: 0, z: 0, w: t, h, d, colour: wall });
  slab(bag, g, { x: w / 2 - t / 2, y: 0, z: 0, w: t, h, d, colour: wall });

  // ရှေ့နံရံ — **အလယ်မှာ တံခါးဝ ချန်**
  const fz = d / 2 - t / 2;
  slab(bag, g, { x: -(door / 2 + side / 2), y: 0, z: fz, w: side, h, d: t, colour: wall });
  slab(bag, g, { x: door / 2 + side / 2, y: 0, z: fz, w: side, h, d: t, colour: wall });
  // တံခါးဝ အပေါ်က အုတ်ခုံး — ခေါင်းအထက်မှာ ရှိလို့ ဝင်ထွက်ကို မပိတ်ဘူး
  slab(null, g, { x: 0, y: 2.6, z: fz, w: door, h: h - 2.6, d: t, colour: wall, collide: false });

  // ပြတင်းပေါက်များ — အထပ်တိုင်း ရှေ့မျက်နှာမှာ
  for (let s = 1; s < storeys; s++) {
    for (const sx of [-w / 4, w / 4]) {
      slab(null, g, { x: sx, y: s * (h / storeys) + 0.5, z: fz + 0.05,
                      w: 1.5, h: 1.3, d: 0.1, colour: 0x1a2436, collide: false });
    }
  }
  // အထပ်ခွဲ မျဉ်း — အထပ်တွေ မြင်ရအောင်
  for (let s = 1; s < storeys; s++) {
    slab(null, g, { x: 0, y: s * (h / storeys) - 0.12, z: 0, w: w + 0.3, h: 0.24, d: d + 0.3,
                    colour: trim, collide: false });
  }

  // အမိုး — အနည်းငယ် ထွက်နေတဲ့ ခေါင်မိုး
  const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.45, d + 0.8), mat(roof));
  r.position.y = h + 0.2;
  g.add(r);
  // မျက်နှာကြက် အမိုးထောင့် — ရှေ့ဘက် ဆင်းနေတဲ့ အကွက်
  const eave = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.25, 1.6), mat(roof));
  eave.position.set(0, h - 0.35, d / 2 + 0.5);
  eave.rotation.x = -0.28;
  g.add(eave);

  return place(room, g, { x, z, rot, bag });
}

/**
 * 🏢 မြင့်မားတဲ့ တိုက် — ဘန်ကောက် ပုံစံ။ **အောက်ထပ် lobby ဝင်လို့ရတယ်**。
 * အပေါ်ပိုင်းက အတုံးပဲ ဖြစ်ပေမယ့် အောက်ထပ်မှာ တံခါးဝ + ကြမ်းပြင် ရှိတယ်။
 */
export function tower(room, {
  x = 0, z = 0, rot = 0, w = 10, d = 10, h = 34,
  body = 0x7d8794, glass = 0x2a4b63,
} = {}) {
  const g = new THREE.Group();
  const bag = [];
  const t = 0.4, door = 3.0, lobby = 4.5;
  const side = (w - door) / 2;

  slab(null, g, { x: 0, y: -0.05, z: 0, w, h: 0.1, d, colour: 0x8f8f8f, collide: false });
  // အောက်ထပ် နံရံ — ရှေ့မှာ တံခါးဝ
  slab(bag, g, { x: 0, y: 0, z: -d / 2 + t / 2, w, h: lobby, d: t, colour: body });
  slab(bag, g, { x: -w / 2 + t / 2, y: 0, z: 0, w: t, h: lobby, d, colour: body });
  slab(bag, g, { x: w / 2 - t / 2, y: 0, z: 0, w: t, h: lobby, d, colour: body });
  const fz = d / 2 - t / 2;
  slab(bag, g, { x: -(door / 2 + side / 2), y: 0, z: fz, w: side, h: lobby, d: t, colour: glass });
  slab(bag, g, { x: door / 2 + side / 2, y: 0, z: fz, w: side, h: lobby, d: t, colour: glass });

  // အပေါ်ပိုင်း — lobby အမိုးပေါ်မှာ (ဝင်စရာ မရှိလို့ တစ်တုံးတည်း)
  const up = new THREE.Mesh(new THREE.BoxGeometry(w, h - lobby, d), mat(body));
  up.position.y = lobby + (h - lobby) / 2;
  g.add(up);
  // မှန်တန်း — အလျားလိုက် အစင်းများ
  for (let y = lobby + 2; y < h - 1; y += 3.2) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 1.5, d + 0.12), mat(glass, {
      metalness: 0.5, roughness: 0.25,
    }));
    band.position.y = y;
    g.add(band);
  }
  place(room, g, { x, z, rot, bag });
  // အပေါ်ထပ် — lobby အမိုးအထက်ကို တစ်ခုတည်းနဲ့ (ဝင်စရာ မရှိလို့)
  room.colliders.push(new THREE.Box3(
    new THREE.Vector3(x - w / 2, lobby, z - d / 2),
    new THREE.Vector3(x + w / 2, h, z + d / 2),
  ));
  return g;
}

/// 🌴 ထန်းပင် — ဖူးခက်/ကမ်းခြေ အတွက်
export function palm(group, x, z, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.3, 6.5, 6), mat(0x7a5c3a));
  trunk.position.y = 3.25;
  trunk.rotation.z = 0.08;
  g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 3.2), mat(0x2f7d3a));
    f.position.set(Math.cos(i / 7 * Math.PI * 2) * 1.2, 6.4, Math.sin(i / 7 * Math.PI * 2) * 1.2);
    f.rotation.y = i / 7 * Math.PI * 2;
    f.rotation.x = -0.42;
    g.add(f);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  group.add(g);
  return g;
}

/// 🌊 ရေပြင် — မြစ်/ပင်လယ်။ collider မထည့်ဘူး (ရေထဲ လျှောက်လို့ရတယ်)
export function water(group, { x = 0, z = 0, w = 200, d = 80, y = -0.4, colour = 0x2f6f8f } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({
    color: colour, roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.9,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

/// 🛣️ လမ်း — မြေပြင်ပေါ် အနက်ရောင် အကွက်
export function road(group, { x = 0, z = 0, w = 10, d = 120, rot = 0, colour = 0x2a2c33 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(colour, { roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = rot;
  m.position.set(x, 0.01, z);
  group.add(m);
  return m;
}

/// ⛩️ တံတား/ဂိတ် — နယ်စပ် ချစ်ကြည်ရေးတံတား ပုံစံ (အောက်က ဖြတ်လျှောက်လို့ရ)
export function gateArch(room, { x = 0, z = 0, rot = 0, w = 16, h = 9, colour = 0xd8d2c4 } = {}) {
  const g = new THREE.Group();
  const bag = [];
  for (const sx of [-w / 2, w / 2]) {
    slab(bag, g, { x: sx, y: 0, z: 0, w: 1.6, h, d: 1.6, colour });
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 1.4, 2.2), mat(colour));
  top.position.y = h + 0.7;
  g.add(top);
  return place(room, g, { x, z, rot, bag });
}

/// 🛕 သေးငယ်တဲ့ စေတီ — ဘုရားသုံးဆူ/ဘုန်းကြီးကျောင်း အတွက်
/// (ရင်ပြင် ရှိတယ် — ပေါ်တက်လို့ ရအောင် collider က ရင်ပြင်ပဲ)
export function smallStupa(room, { x = 0, z = 0, h = 14, gold = true } = {}) {
  const g = new THREE.Group();
  const c = gold ? 0xe8b830 : 0xeae4d6;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.0, 0.8, 12), mat(0xe8e2d2));
  plinth.position.y = 0.4; g.add(plinth);
  let y = 0.8;
  for (const [r0, r1, hh] of [[4.0, 3.4, h * 0.13], [3.3, 2.7, h * 0.11], [2.6, 2.1, h * 0.09]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, hh, 12),
      mat(c, { metalness: gold ? 0.7 : 0.1, roughness: gold ? 0.3 : 0.8 }));
    m.position.y = y + hh / 2; g.add(m); y += hh;
  }
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    mat(c, { metalness: gold ? 0.8 : 0.1, roughness: gold ? 0.25 : 0.8 }));
  bell.position.y = y; bell.scale.y = 1.3; g.add(bell); y += 2.1 * 1.3;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.75, h - y, 10),
    mat(c, { metalness: gold ? 0.8 : 0.1, roughness: 0.25 }));
  spire.position.y = y + (h - y) / 2; g.add(spire);
  g.position.set(x, 0, z);
  room.group.add(g);
  // ရင်ပြင်ကိုပဲ collider — အပေါ်ပိုင်းက ခေါင်းအထက်မှာ ရှိလို့ မလို
  room.colliders.push(new THREE.Box3(
    new THREE.Vector3(x - 4.6, 0, z - 4.6), new THREE.Vector3(x + 4.6, 0.8, z + 4.6)));
  return g;
}

/// 🏮 ဈေးဆိုင် တဲ — ညဈေးတန်း အတွက် (အောက်က ဖြတ်လျှောက်လို့ရ)
export function marketStall(room, { x = 0, z = 0, rot = 0, colour = 0xc94f4f } = {}) {
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]]) {
    slab(null, g, { x: sx, y: 0, z: sz, w: 0.12, h: 2.4, d: 0.12, colour: 0x6b5b45, collide: false });
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 2.6), mat(colour));
  canopy.position.y = 2.5; g.add(canopy);
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.2), mat(0x8a6f4a));
  table.position.set(0, 0.85, -0.4); g.add(table);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  room.group.add(g);
  // စားပွဲကိုပဲ တားတယ် — တဲထဲ ဝင်လို့ရအောင်
  room.colliders.push(new THREE.Box3(
    new THREE.Vector3(x - 1.7, 0, z - 1.1), new THREE.Vector3(x + 1.7, 0.95, z + 0.3)));
  return g;
}
