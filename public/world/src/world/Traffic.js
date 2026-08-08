// ============================================================
// Traffic.js — 🛣️ **မြို့ပြ အခြေခံ** — ကားလမ်း, မီးပွိုင့်, လမ်းမီး, မြက်ခင်း
//
// user: "Cyber-Yangon City ကို ၅ဆ ခန့် မြို့ကိုချဲ့ပါ … ကားလမ်းများ
//        မြက်ခင်းပြင်များ အသေးစိတ်ထည့်ပါ မီးပွိုင့်များ …"
//
// ═══ ဘာကြောင့် module သီးသန့် လုပ်ရလဲ ═══
//
// မြို့ကို ၅ဆ ချဲ့တယ် ဆိုတာ **ပစ္စည်း ၅ဆ ချထားရုံ မဟုတ်ဘူး** — လမ်းမီးတိုင်
// ၂၅၀ လုံး, လမ်းမျဉ်း ၁,၀၀၀ ကျော် ဆိုတာ mesh အသီးသီး လုပ်ရင် draw call
// ထောင်ချီ ဖြစ်ပြီး ဖုန်းမှာ ရိုက်ချိုးသွားမယ်။ ဒါကြောင့် **ထပ်နေတဲ့ အရာ
// အားလုံးကို `InstancedMesh`** နဲ့ လုပ်တယ် — ဘယ်နှစ်လုံး ရှိရှိ draw call
// **တစ်ခုပဲ**。
//
//     လမ်းမျဉ်း ၁,၀၀၀+   → draw call ၁
//     လမ်းမီးတိုင် ၂၅၀    → draw call ၂ (တိုင် + မီးအိမ်)
//     စိမ်းလန်း ထန်းပင်    → draw call ၂
//
// ★ လမ်းတွေမှာ **collider မထည့်ဘူး** — လမ်းက လျှောက်ဖို့ ဖြစ်တယ်၊
//   ပလက်ဖောင်းနဲ့ ၀.၁၅ m ပဲ ကွာလို့ ကျော်နင်းလို့ ရတယ်။
// ★ **လမ်းမီးတိုင်မှာလည်း collider မထည့်ဘူး** — တိုင် ၅၀၀ ကျော်ရှိတယ်၊
//   collider က frame တိုင်း စစ်ရတာမို့ physics ကို ဒီအရေအတွက်နဲ့
//   ထည့်လိုက်ရင် လမ်းလျှောက်တာ ခက်သွားမယ်။ မီးပွိုင့်တိုင် (၁၆ ခုပဲ) နဲ့
//   ကန်ဘောင် လက်ရန်းမှာတော့ ရှိတယ် — အဲဒါတွေက တကယ် တားရမယ့်ဟာ။
// ============================================================
import * as THREE from 'three';
import { trackQuality } from '../core/Quality.js';

const ASPHALT = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.92, metalness: 0.02 });
const PAINT = new THREE.MeshStandardMaterial({ color: 0xd8d3bd, roughness: 0.8 });
const KERB = new THREE.MeshStandardMaterial({ color: 0x9aa0ab, roughness: 0.85 });
const POLE = new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.5, metalness: 0.5 });
const GRASS = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 1 });

/// အလင်း မထွန်းတဲ့ မီးလုံး အရောင် — `emissiveIntensity` ကိုပဲ ရွှေ့တယ်
function lampMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: hex, emissive: hex, emissiveIntensity: 0.12, roughness: 0.4,
  });
}

/**
 * 🛣️ **ကားလမ်း ကွန်ရက်** — x နဲ့ z ဘက် လမ်းမကြီးများ ဆုံရာ ကွက်ကွက်。
 *
 * @param room
 * @param o.lines   — လမ်းမကြီး တည်ရာ ကိုဩဒိနိတ် (x ရော z ရော တူတူ သုံး)
 * @param o.reach   — လမ်း တစ်ချောင်းရဲ့ အရှည် တစ်ဝက် (±reach)
 * @param o.width   — လမ်း အကျယ်
 * @returns { nodes } — လမ်းဆုံ အားလုံးရဲ့ [x, z]
 */
export function roadGrid(room, { lines = [-300, -200, -100, 0, 100, 200, 300],
                                 reach = 340, width = 14 } = {}) {
  const g = room.group;

  // ── လမ်းမျက်နှာပြင် ─────────────────────────────────────────────
  // ★ လမ်း တစ်ချောင်းက plane တစ်ခု — ၁၄ ချောင်းဆို draw call ၁၄。
  //   အဲဒါလောက်က ကိစ္စ မရှိဘူး (မျဉ်းတွေက ထောင်ချီ ရှိတာ)。
  const roadGeo = new THREE.PlaneGeometry(width, reach * 2);
  for (const c of lines) {
    const ns = new THREE.Mesh(roadGeo, ASPHALT);
    ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0.02, 0);
    ns.receiveShadow = true; g.add(ns);
    const ew = new THREE.Mesh(roadGeo, ASPHALT);
    ew.rotation.x = -Math.PI / 2; ew.rotation.z = Math.PI / 2;
    ew.position.set(0, 0.021, c);
    ew.receiveShadow = true; g.add(ew);
  }

  // ── လမ်းအလယ် အဖြူမျဉ်း — **တစ်ခုတည်းသော draw call** ─────────────
  const dashGeo = new THREE.PlaneGeometry(0.35, 4);
  const dashes = [];
  const STEP = 10;
  for (const c of lines) {
    for (let t = -reach + 6; t < reach - 6; t += STEP) {
      // လမ်းဆုံ အတွင်း မျဉ်း မဆွဲဘူး
      if (lines.some(o => Math.abs(t - o) < width * 0.75)) continue;
      dashes.push([c, t, 0], [t, c, Math.PI / 2]);
    }
  }
  const dash = new THREE.InstancedMesh(dashGeo, PAINT, dashes.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  const e = new THREE.Euler();
  dashes.forEach(([x, z, rot], i) => {
    e.set(-Math.PI / 2, 0, rot);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, 0.03, z), q, s);
    dash.setMatrixAt(i, m);
  });
  dash.instanceMatrix.needsUpdate = true;
  g.add(dash);

  // ── ပလက်ဖောင်း အနားသတ် — လမ်းနှစ်ဖက် ────────────────────────────
  const kerbGeo = new THREE.BoxGeometry(0.5, 0.16, reach * 2);
  const kerbs = [];
  for (const c of lines) {
    for (const side of [-1, 1]) {
      kerbs.push([c + side * (width / 2 + 0.25), 0, 0]);
      kerbs.push([0, c + side * (width / 2 + 0.25), Math.PI / 2]);
    }
  }
  const kerb = new THREE.InstancedMesh(kerbGeo, KERB, kerbs.length);
  kerbs.forEach(([x, z, rot], i) => {
    e.set(0, rot, 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(rot ? 0 : x, 0.08, rot ? z : 0), q, s);
    kerb.setMatrixAt(i, m);
  });
  kerb.instanceMatrix.needsUpdate = true;
  g.add(kerb);
  // 🎚️ မျဉ်း/အနားသတ်က အနီးကပ် အသေးစိတ် — ဂရပ်ဖစ် အနိမ့်မှာ ဖျောက်တယ်၊
  //    လမ်းမျက်နှာပြင်ကတော့ ကျန်တယ် (မရှိရင် လမ်း မဟုတ်တော့ဘူး)。
  trackQuality(dash, 'detail');
  trackQuality(kerb, 'detail');

  const nodes = [];
  for (const x of lines) for (const z of lines) nodes.push([x, z]);
  return { nodes };
}

/**
 * 🚦 **မီးပွိုင့်** — အနီ/အဝါ/အစိမ်း သုံးလုံး, အချိန်နဲ့ လှည့်တယ်。
 *
 * ★ `room.signals` ထဲ စာရင်းသွင်းတယ်၊ `Room.update` က `updateSignals`
 *   ကို frame တိုင်း ခေါ်တယ်။
 * ★ တိုင်မှာ collider ရှိတယ် (တကယ့် အတားအဆီး)၊ ဒါပေမယ့် **အရမ်း သေး**
 *   အောင် ထားတယ် (၀.၂ m) — မဟုတ်ရင် လမ်းဆုံတိုင်းမှာ လမ်းပိတ်နေမယ်။
 */
export function trafficLight(room, { x = 0, z = 0, rot = 0, phase = 0 } = {}) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = rot;

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 8), POLE);
  mast.position.y = 3; grp.add(mast);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.14), POLE);
  arm.position.set(1.3, 5.9, 0); grp.add(arm);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.4), POLE);
  box.position.set(2.4, 5.2, 0); grp.add(box);

  const lamps = [];
  const COLOURS = [0xff3b30, 0xffcc00, 0x34c759];
  COLOURS.forEach((hex, i) => {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), lampMat(hex));
    lamp.position.set(2.4, 5.7 - i * 0.5, 0.21);
    grp.add(lamp);
    lamps.push(lamp.material);
  });

  room.group.add(grp);
  room.colliders.push(new THREE.Box3(
    new THREE.Vector3(x - 0.25, 0, z - 0.25),
    new THREE.Vector3(x + 0.25, 6, z + 0.25)));
  (room.signals ||= []).push({ lamps, phase });
  return grp;
}

/// 🚦 အလှည့် — အစိမ်း ၉s → အဝါ ၂s → အနီ ၁၁s (စုစုပေါင်း ၂၂s)。
/// လမ်းဆုံတစ်ခုနဲ့တစ်ခု `phase` နဲ့ ရွှေ့ထားလို့ တစ်ပြိုင်တည်း မပြောင်းဘူး。
const CYCLE = 22, GREEN = 9, AMBER = 2;
export function updateSignals(room, time) {
  const list = room.signals;
  if (!list?.length) return;
  for (const s of list) {
    const t = (time + s.phase) % CYCLE;
    const on = t < GREEN ? 2 : t < GREEN + AMBER ? 1 : 0;
    for (let i = 0; i < 3; i++) s.lamps[i].emissiveIntensity = i === on ? 2.6 : 0.12;
  }
}

/**
 * 💡 **လမ်းမီးတိုင်** — လမ်းတစ်လျှောက် ထပ်ခါထပ်ခါ。 InstancedMesh ၂ ခုပဲ。
 *
 * ★ တကယ့် `PointLight` က **ထည့်မထားဘူး** — မီး ၂၅၀ လုံး ဆိုရင် shader က
 *   ခံနိုင်မှာ မဟုတ်ဘူး။ မီးအိမ်က emissive နဲ့ တောက်ပြီး၊ တကယ့် အလင်းက
 *   အခန်းရဲ့ ပင်မ အလင်းစနစ်ကနေ ရတယ်။ အလယ်မှာပဲ တကယ့်မီး နည်းနည်း
 *   ထည့်ထားတယ် (YangonRoom မှာ)。
 */
export function streetLamps(room, points) {
  if (!points.length) return;
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.15, 7, 6);
  const headGeo = new THREE.BoxGeometry(1.1, 0.22, 0.5);
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffd9a0, emissive: 0xffd9a0, emissiveIntensity: 1.6, roughness: 0.5,
  });
  const pole = new THREE.InstancedMesh(poleGeo, POLE, points.length);
  const head = new THREE.InstancedMesh(headGeo, glow, points.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  const e = new THREE.Euler();
  points.forEach(([x, z, rot = 0], i) => {
    e.set(0, rot, 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, 3.5, z), q, s); pole.setMatrixAt(i, m);
    // မီးအိမ်က လမ်းဘက်ကို ကမ်းထွက်
    const dx = Math.sin(rot) * 0.6, dz = Math.cos(rot) * 0.6;
    m.compose(new THREE.Vector3(x + dx, 7.0, z + dz), q, s); head.setMatrixAt(i, m);
  });
  pole.instanceMatrix.needsUpdate = true;
  head.instanceMatrix.needsUpdate = true;
  room.group.add(pole, head);
  trackQuality(pole, 'detail');
  trackQuality(head, 'detail');
}

/**
 * 🌱 **မြက်ခင်းပြင်** — လမ်းကွက်တွေကြားက အစိမ်းရောင် ကွက်လပ်。
 * collider မထည့်ဘူး (လျှောက်လို့ရတယ်)。 `y` က မြေထက် ၂ စင်တီ တင်ထားတယ် —
 * z-fight မဖြစ်အောင်。
 */
export function grassField(room, { x = 0, z = 0, w = 60, d = 60 } = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), GRASS);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.015, z);
  mesh.receiveShadow = true;
  room.group.add(mesh);
  return mesh;
}

/**
 * 🌳 **အပင်များ** — မြက်ခင်းပေါ်က သစ်ပင်。 InstancedMesh ၂ ခု
 * (ပင်စည် + အရွက်)。 collider က ပင်စည်မှာပဲ。
 */
export function treeRow(room, points, { collide = true } = {}) {
  if (!points.length) return;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 4.2, 6);
  const leafGeo = new THREE.SphereGeometry(2.2, 8, 6);
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 1 });
  const trunk = new THREE.InstancedMesh(trunkGeo, bark, points.length);
  const crown = new THREE.InstancedMesh(leafGeo, leaf, points.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  points.forEach(([x, z, sc = 1], i) => {
    const s = new THREE.Vector3(sc, sc, sc);
    m.compose(new THREE.Vector3(x, 2.1 * sc, z), q, s); trunk.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 5.0 * sc, z), q, s); crown.setMatrixAt(i, m);
    if (collide) room.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 0.35, 0, z - 0.35),
      new THREE.Vector3(x + 0.35, 4 * sc, z + 0.35)));
  });
  trunk.instanceMatrix.needsUpdate = true;
  crown.instanceMatrix.needsUpdate = true;
  room.group.add(trunk, crown);
  trackQuality(trunk, 'detail');
  trackQuality(crown, 'detail');
}

/**
 * 🛣️ **လမ်းကြောင်း** — အချက်တွေကို ဆက်တဲ့ လမ်း (ကွက်ကွက် မဟုတ်ဘူး)。
 *
 * user: "အိမ်များတောင်များ ဘုရားများကို လမ်းများအသေးစိတ်ချိတ်ဆက်ပါ"
 *
 * ★ ကွက်ကွက် လမ်းက မြို့လယ်အတွက်ပဲ ကောင်းတယ် — စေတီက ၂၅၀ m အပြင်မှာ,
 *   အိမ်တော်က တောင်ခြေမှာ ရှိလို့ ကွက်ထဲ မဝင်ဘူး။ ဒီဟာက အချက်နှစ်ချက်
 *   ကြားကို လမ်းအပိုင်း တစ်ခုချင်း ချပေးတယ် (ကွေ့ရင် အဆစ်မှာ စက်ဝိုင်း
 *   အခင်း ခံပေးလို့ ချောင်း မပေါ်ဘူး)。
 * ★ collider မထည့်ဘူး — လမ်းက လျှောက်ဖို့。
 */
export function roadPath(room, points, { width = 10, colour = null } = {}) {
  const mat = colour
    ? new THREE.MeshStandardMaterial({ color: colour, roughness: 0.92 })
    : ASPHALT;
  const g = room.group;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mat);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -Math.atan2(dx, dz);
    seg.position.set((x0 + x1) / 2, 0.025, (z0 + z1) / 2);
    seg.receiveShadow = true;
    g.add(seg);
    // အဆစ်မှာ စက်ဝိုင်း — ကွေ့တဲ့နေရာ ချောင်း မပေါ်အောင်
    if (i > 0) {
      const joint = new THREE.Mesh(new THREE.CircleGeometry(width / 2, 14), mat);
      joint.rotation.x = -Math.PI / 2;
      joint.position.set(x0, 0.026, z0);
      g.add(joint);
    }
  }
}

/**
 * 🏞️ **အင်းလျားကန် + ကန်ဘောင်**
 *
 * user: "အင်းလျှား ရေကန်ထည့်ပါ အင်းလျှားကန်ဘောင်ထည့်ပါ"
 *
 * ★ ရေထဲ ဝင်လို့ မရအောင် **ကန်ဘောင် လက်ရန်း**က တားတယ် — ရေမျက်နှာပြင်
 *   ကိုယ်တိုင်ကို collider မလုပ်ဘူး။ ဒါက အင်းလျားကန် အစစ်နဲ့လည်း
 *   တူတယ် (ကန်ပတ်လမ်း + သံလက်ရန်း)。
 * ★ လက်ရန်းတိုင်တွေက InstancedMesh — ၉၆ တိုင် ဆိုပေမယ့် draw call ၂。
 * ★ collider က တိုင်တစ်ခုချင်း မဟုတ်ဘဲ **အပိုင်းလိုက် ဘောက်စ်** —
 *   တိုင်ချင်းကြား ၄ m ကွာလို့ တိုင်ကိုပဲ collider လုပ်ရင် ကြားထဲက
 *   လျှောက်ဝင်လို့ ရနေမယ်။
 */
export function lake(room, { x = 0, z = 0, rx = 90, rz = 60, segments = 48 } = {}) {
  const g = room.group;

  // ★ ရေမျက်နှာပြင်ကို **လမ်းထက် အပေါ်မှာ** ထားတယ် (y ၀.၂)。
  //   အောက်မှာ ထားရင် လမ်းမကြီးတွေက ကန်ကို **ဖြတ်ကူးနေတာ မြင်ရတယ်** —
  //   ပလက်ဖောင်း အနားသတ် (အမြင့် ၀.၁၆) က ရေပေါ် ဖြူဖြူ မျဉ်းလို ပေါ်နေမယ်။
  //   ၀.၂ မှာ ထားတော့ ကန်က လမ်းကို ဖုံးလိုက်ပြီး တကယ့် ကန်ကမ်းပါးလို
  //   ဖြစ်သွားတယ် — လမ်းတွေက ကန်နားမှာ အဆုံးသတ်သွားတယ်။
  // ★ ညမှာ ရေက **မဲမနေရ** — အရောင် ဖျော့ဖျော့နဲ့ emissive နည်းနည်း
  //   ထည့်ထားတယ်၊ မဟုတ်ရင် နောက်ခံ ညရောင်နဲ့ ရောပြီး တွင်းကြီးလို
  //   မြင်ရတယ် (render နဲ့ တွေ့ခဲ့တာ)。
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, segments),
    new THREE.MeshStandardMaterial({
      color: 0x2f7ba8, emissive: 0x0d2a3d, emissiveIntensity: 0.9,
      roughness: 0.28, metalness: 0.3,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(rx, rz, 1);
  water.position.set(x, 0.2, z);
  water.receiveShadow = true;
  g.add(water);

  // ကန်ဘောင် လမ်း — ရေအနားပတ် ၇ m ကျယ်တဲ့ လမ်း
  const walk = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.14, segments),
    new THREE.MeshStandardMaterial({ color: 0x6e6a60, roughness: 0.95 })
  );
  walk.rotation.x = -Math.PI / 2;
  walk.scale.set(rx + 3.5, rz + 3.5, 1);
  walk.position.set(x, 0.22, z);
  walk.receiveShadow = true;
  g.add(walk);

  // လက်ရန်း — ရေဘက် အနားမှာ
  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6);
  const railGeo = new THREE.BoxGeometry(0.06, 0.06, 1);
  const steel = new THREE.MeshStandardMaterial({ color: 0x8f98a6, metalness: 0.6, roughness: 0.4 });
  const n = segments;
  const post = new THREE.InstancedMesh(postGeo, steel, n);
  const rail = new THREE.InstancedMesh(railGeo, steel, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const at = (i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * (rx + 1.2), z + Math.sin(a) * (rz + 1.2)];
  };
  for (let i = 0; i < n; i++) {
    const [px, pz] = at(i);
    const [nx, nz] = at((i + 1) % n);
    m.compose(new THREE.Vector3(px, 0.78, pz), new THREE.Quaternion(), one);
    post.setMatrixAt(i, m);
    const len = Math.hypot(nx - px, nz - pz);
    e.set(0, Math.atan2(nx - px, nz - pz), 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3((px + nx) / 2, 1.2, (pz + nz) / 2), q,
              new THREE.Vector3(1, 1, len));
    rail.setMatrixAt(i, m);
    // ★ အပိုင်းလိုက် collider — တိုင်ချင်းကြားက ဟာမကျန်စေရ
    room.colliders.push(new THREE.Box3(
      new THREE.Vector3(Math.min(px, nx) - 0.4, 0, Math.min(pz, nz) - 0.4),
      new THREE.Vector3(Math.max(px, nx) + 0.4, 1.2, Math.max(pz, nz) + 0.4)));
  }
  post.instanceMatrix.needsUpdate = true;
  rail.instanceMatrix.needsUpdate = true;
  g.add(post, rail);
  return { water, walk };
}

/**
 * 🏢 **ရပ်ကွက် ဖြည့် အဆောက်အအုံများ** — လမ်းကွက်ကြားက ဗလာတွေ ဖြည့်ဖို့。
 *
 * ★ မြို့ကို ၂၀ ဆ ချဲ့လိုက်တော့ လမ်းက ရှိပေမယ့် **ကွက်ထဲ ဘာမှ မရှိ**
 *   ဖြစ်နေတယ် (render နဲ့ တွေ့ခဲ့တာ — လမ်းချည်းပဲ, ကွက်က မှောင်နေတယ်)。
 *   တစ်လုံးချင်း mesh လုပ်ရင် ရာချီ draw call ဖြစ်မယ်၊ ဒါကြောင့်
 *   **InstancedMesh ၂ ခုပဲ** — ကိုယ်ထည် + အမိုးအနား。
 * ★ အထဲ ဝင်လို့ မရဘူး — ဒါတွေက နောက်ခံ အဆောက်အအုံပဲ။ ဝင်လို့ရတဲ့
 *   အိမ်တွေက မော်ဒယ် အစစ် (colonial/stilt/shophouse) ဖြစ်တယ်၊ အဲဒါတွေကို
 *   လမ်းမကြီး ဘေးမှာ ချထားတယ်。 collider ရှိတယ် — ဖောက်ဝင်လို့ မရ。
 */
export function fillerBlocks(room, boxes, { tier = 'detail' } = {}) {
  if (!boxes.length) return;
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const capGeo = new THREE.BoxGeometry(1.06, 0.08, 1.06);
  const wall = new THREE.MeshStandardMaterial({ color: 0x232c46, roughness: 0.85, metalness: 0.1 });
  const cap = new THREE.MeshStandardMaterial({
    color: 0x3d4a72, emissive: 0x2a3560, emissiveIntensity: 0.6, roughness: 0.6,
  });
  const body = new THREE.InstancedMesh(bodyGeo, wall, boxes.length);
  const top = new THREE.InstancedMesh(capGeo, cap, boxes.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  boxes.forEach(([x, z, w, d, h], i) => {
    m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d));
    body.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, h + 0.04, z), q, new THREE.Vector3(w, 1, d));
    top.setMatrixAt(i, m);
    room.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - w / 2, 0, z - d / 2),
      new THREE.Vector3(x + w / 2, h, z + d / 2)));
  });
  body.instanceMatrix.needsUpdate = true;
  top.instanceMatrix.needsUpdate = true;
  room.group.add(body, top);
  trackQuality(body, tier);
  trackQuality(top, tier);
}

// ============================================================
// 🚌 **YBS ဘတ်စ်ကား လိုင်းများ**
//
// user: "ရန်ကုန်မြို့ bus cars လိုင်းများထည့်သွင်းပါ"
//
// ★ ဒါက **သွားနေတဲ့ ကား** — ကစားသမား မောင်းတဲ့ ကား (Vehicle.js) မဟုတ်ဘူး။
//   လမ်းကြောင်း အတိုင်း အလိုအလျောက် ပတ်ပြီး မှတ်တိုင်မှာ ရပ်တယ်။
//   physics မလိုဘူး — collider က ဘတ်စ်ကားနဲ့ အတူ **မလိုက်ဘူး**၊
//   ရွေ့နေတဲ့ collider ဆိုတာ frame တိုင်း box ပြန်တွက်ရလို့ စျေးကြီးတယ်၊
//   ပြီးတော့ လမ်းလယ်မှာ ရုတ်တရက် တွန်းထုတ်ခံရတာက ပိုဆိုးတယ်။
//   ကားက ဖြတ်သွားရင် ကျော်လျှောက်လို့ ရတယ် — မြင်ကွင်း အသက်ဝင်ဖို့ပဲ။
// ★ ဘတ်စ်ကား တစ်စီးက mesh ၅ ခုပဲ (ကိုယ်ထည်, အမိုး, မှန်တန်း, ဘီး ၂)。
//   လိုင်း ၃ ခု × ၃ စီး = ၄၅ mesh — ဒါလောက်က ကိစ္စ မရှိဘူး。
// ============================================================
const BUS_BODY = new THREE.BoxGeometry(2.6, 2.5, 9);
const BUS_GLASS = new THREE.BoxGeometry(2.64, 0.9, 7.4);
const BUS_WHEEL = new THREE.CylinderGeometry(0.55, 0.55, 2.5, 10);

function makeBus(colour) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(BUS_BODY, new THREE.MeshStandardMaterial({
    color: colour, roughness: 0.55, metalness: 0.2,
  }));
  body.position.y = 1.85; g.add(body);
  const glass = new THREE.Mesh(BUS_GLASS, new THREE.MeshStandardMaterial({
    color: 0x9fd4ea, emissive: 0x2a4a5c, emissiveIntensity: 0.8,
    roughness: 0.15, metalness: 0.6,
  }));
  glass.position.y = 2.45; g.add(glass);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 8.6),
    new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.8 }));
  roof.position.y = 3.15; g.add(roof);
  const tyre = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.95 });
  for (const z of [-3, 3]) {
    const w = new THREE.Mesh(BUS_WHEEL, tyre);
    w.rotation.z = Math.PI / 2; w.position.set(0, 0.55, z);
    g.add(w);
  }
  return g;
}

/**
 * 🚌 လိုင်းတစ်ခု — အချက်များကို ပတ်လမ်းအဖြစ် ဆက်ပြီး ကား `count` စီး လွှတ်တယ်。
 * @param o.points — [[x,z], …] ပတ်လမ်း (နောက်ဆုံးက ပထမနဲ့ ပြန်ဆက်တယ်)
 * @param o.stops  — မှတ်တိုင် အညွှန်း (points ရဲ့ index)
 */
export function busLine(room, { points, colour = 0xd8324a, count = 3,
                                speed = 9, stops = [], label = 'YBS' } = {}) {
  if (!points || points.length < 2) return;
  // အပိုင်း အရှည်များ — total ကနေ ကားတွေကို ညီညီ ခွဲထား
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len, start: total });
    total += len;
  }
  const buses = [];
  for (let i = 0; i < count; i++) {
    const mesh = makeBus(colour);
    room.group.add(mesh);
    trackQuality(mesh, 'detail');
    buses.push({ mesh, s: (total / count) * i, wait: 0 });
  }
  (room.buses ||= []).push({ segs, total, buses, speed, stops, label });

  // 🚏 မှတ်တိုင် — အမိုး + တိုင် + ဆိုင်းဘုတ်
  for (const idx of stops) {
    const [sx, sz] = points[idx % points.length];
    const shelter = new THREE.Group();
    shelter.position.set(sx + 6, 0, sz);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x39508c, roughness: 0.7 }));
    roof.position.y = 2.8; shelter.add(roof);
    const pole = new THREE.MeshStandardMaterial({ color: 0x8f98a6, metalness: 0.6, roughness: 0.4 });
    for (const dx of [-2.2, 2.2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6), pole);
      p.position.set(dx, 1.4, 0); shelter.add(p);
    }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4, 0.16, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.9 }));
    bench.position.set(0, 0.6, -0.6); shelter.add(bench);
    room.group.add(shelter);
    trackQuality(shelter, 'detail');
    room.colliders.push(new THREE.Box3(
      new THREE.Vector3(sx + 3.6, 0, sz - 1.4),
      new THREE.Vector3(sx + 8.4, 3, sz + 1.4)));
  }
}

/// 🚌 frame တိုင်း — ပတ်လမ်းအတိုင်း ရွှေ့, မှတ်တိုင်မှာ ၃ စက္ကန့် ရပ်
export function updateBuses(room, dt) {
  const lines = room.buses;
  if (!lines?.length) return;
  for (const line of lines) {
    for (const bus of line.buses) {
      if (bus.wait > 0) { bus.wait -= dt; continue; }
      bus.s = (bus.s + line.speed * dt) % line.total;
      // ဘယ် အပိုင်းပေါ်မှာ ရှိလဲ
      let seg = line.segs[0];
      for (const sg of line.segs) if (bus.s >= sg.start) seg = sg;
      const t = (bus.s - seg.start) / seg.len;
      const x = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
      const z = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
      bus.mesh.position.set(x, bus.lockY ?? 0, z);
      bus.mesh.rotation.y = Math.atan2(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
      // မှတ်တိုင် ရောက်ရင် ရပ် — အပိုင်း အဆုံးနား (၉၅%) ရောက်မှ
      const idx = line.segs.indexOf(seg);
      if (line.stops.includes(idx) && t > 0.95 && bus.wait <= 0) bus.wait = 3;
    }
  }
}

/**
 * 🌊 **မြစ်** — မြို့တောင်ဘက်က ရေကြောင်း (ရန်ကုန်မြစ်)。
 *
 * user: "မြစ် ထည့်ပါ ကမ်းနားလမ်းထည့်ပါ"
 *
 * ★ အင်းလျားကန်နဲ့ တူတူ — ရေမျက်နှာပြင်ကို **လမ်းထက် အပေါ်** ထားတယ်
 *   (y ၀.၂)。 အောက်မှာ ထားရင် ကမ်းနားလမ်းရဲ့ အနားသတ်တွေ ရေထဲက
 *   ပေါ်နေမယ်။
 * ★ ရေထဲ ဝင်လို့ မရအောင် **ကမ်းစောင်း နံရံ** နှစ်ဖက် ထားတယ် — ကန်လို
 *   လက်ရန်း မဟုတ်ဘဲ ကွန်ကရစ် ကမ်းထိန်းနံရံ (မြစ်ဆိုတော့ အဲဒါ မှန်တယ်)。
 *   တံတား ဖြတ်ရာမှာတော့ ဟာ ချန်ထားတယ် — မဟုတ်ရင် တံတားပေါ် တက်လို့
 *   ရပေမယ့် ဟိုဘက် ဆင်းလို့ မရဘူး。
 */
export function river(room, { z0 = 340, z1 = 430, x0 = -520, x1 = 520,
                              gaps = [], y = 0.6 } = {}) {
  const g = room.group;
  const w = x1 - x0, d = z1 - z0;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({
      color: 0x2a6d93, emissive: 0x0c2436, emissiveIntensity: 0.9,
      roughness: 0.3, metalness: 0.28,
    }));
  water.rotation.x = -Math.PI / 2;
  // ★ ရေမျက်နှာပြင် ၀.၆ — ကန်လို ၀.၂ မှာ ထားရင် မြစ်က ကျယ်ပြီး အဝေးက
  //   ကြည့်ရတာမို့ မြေနဲ့ depth-fight ဖြစ်ပြီး တစ်ဝက် ပျောက်နေတယ်။
  //   ကမ်းနံရံက ၁.၆ မို့ ဒီအမြင့်မှာလည်း ရေက နံရံအောက်မှာပဲ ရှိသေးတယ်။
  water.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  water.receiveShadow = true;
  g.add(water);

  // ကမ်းထိန်း နံရံ — နှစ်ဖက်、တံတား ဖြတ်ရာမှာ ဟာ ချန်
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 0.95 });
  for (const bankZ of [z0, z1]) {
    let cursor = x0;
    const cuts = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [cx0, cx1] of [...cuts, [x1, x1]]) {
      if (cx0 > cursor) {
        const len = cx0 - cursor;
        // ★ အမြင့် ၁.၆ m — ၁.၁ နဲ့ဆို **ကားတွေ ကျော်ဖြတ်သွားတယ်**。
        //   Vehicle.js က လမ်းရှင်းမရှင်း စစ်တဲ့အခါ probe ကို y ၀.၆ မှာ
        //   ထားတယ်၊ physics က `max.y <= pos.y + 0.55` ဆိုရင် ကြမ်းပြင်လို့
        //   သဘောထားလို့ ၁.၁ က ၁.၁၅ အောက် ဖြစ်နေတယ် — ကျော်သွားတာ။
        const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 1.6, 1.2), wallMat);
        wall.position.set(cursor + len / 2, 0.8, bankZ);
        g.add(wall);
        room.colliders.push(new THREE.Box3(
          new THREE.Vector3(cursor, 0, bankZ - 0.7),
          new THREE.Vector3(cx0, 1.6, bankZ + 0.7)));
      }
      cursor = Math.max(cursor, cx1);
    }
  }
  return water;
}

/**
 * 🌉 **ကြိုးတံတား** — ကြိုးဆွဲ တံတား, လမ်းလျှောက်ဖြတ်လို့ ရတယ်。
 *
 * user: "ကြိုးတံတားထည့်ပါ"
 *
 * ★ **တကယ် ဖြတ်လို့ ရရမယ်** — ဒါက အလှဆင် မဟုတ်ဘူး၊ ဟိုဘက်ကမ်းက
 *   မြို့တွေဆီ သွားဖို့ တစ်ခုတည်းသော လမ်း။ ဒါကြောင့်:
 *     · ကုန်းပတ်လမ်းက **လှေကားထစ်လိုက်** တက်တယ် (တစ်ထစ် ၀.၃၅ m) —
 *       physics က မြေအဖြစ် လက်ခံဖို့ ၀.၅၅ m အောက် ဖြစ်ရမယ်, စောင်းလမ်း
 *       ချောချော လုပ်ရင် box က နံရံ ဖြစ်သွားမယ် (Shwedagon လှေကားမှာ
 *       သင်ခန်းစာ ရခဲ့ပြီး)。
 *     · ကုန်းပတ်တွေက collider ရှိတယ်၊ ကြိုးတွေက မရှိဘူး。
 */
export function cableBridge(room, { x = 0, z0 = 340, z1 = 430, width = 16,
                                    deck = 4.2, ramp = 44 } = {}) {
  const g = room.group;
  const road = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c3d0, metalness: 0.7, roughness: 0.35 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0xdfe6f2, metalness: 0.5, roughness: 0.5 });

  // ── ကုန်းပတ်လမ်း — နှစ်ဖက်、လှေကားထစ်လိုက် ─────────────────────────
  const STEPS = Math.ceil(deck / 0.35);
  const run = ramp / STEPS;
  for (const [zStart, dir] of [[z0 - ramp, 1], [z1 + ramp, -1]]) {
    for (let i = 0; i < STEPS; i++) {
      const y = ((i + 1) / STEPS) * deck;
      const zc = zStart + dir * (i * run + run / 2);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, y, run + 0.4), road);
      slab.position.set(x, y / 2, zc);
      g.add(slab);
      room.colliders.push(new THREE.Box3(
        new THREE.Vector3(x - width / 2, 0, zc - run / 2 - 0.2),
        new THREE.Vector3(x + width / 2, y, zc + run / 2 + 0.2)));
    }
  }

  // ── တံတား ကြမ်းခင်း ───────────────────────────────────────────────
  const span = z1 - z0;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.8, span + 2), road);
  slab.position.set(x, deck - 0.4, (z0 + z1) / 2);
  g.add(slab);
  room.colliders.push(new THREE.Box3(
    new THREE.Vector3(x - width / 2, 0, z0 - 1),
    new THREE.Vector3(x + width / 2, deck, z1 + 1)));

  // ── တိုင်ကြီး ၂ ခု + ကြိုးများ ────────────────────────────────────
  const H = 34;
  const pylonZ = [z0 + span * 0.22, z1 - span * 0.22];
  const cables = [];
  for (const pz of pylonZ) {
    for (const sx of [-width / 2 + 1, width / 2 - 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, H, 1.6), steel);
      p.position.set(x + sx, deck + H / 2, pz);
      g.add(p);
      room.colliders.push(new THREE.Box3(
        new THREE.Vector3(x + sx - 0.9, 0, pz - 0.9),
        new THREE.Vector3(x + sx + 0.9, deck + H, pz + 0.9)));
      // ကြိုး — တိုင်ထိပ်ကနေ ကြမ်းခင်းဆီ ပန်ကာပုံ
      for (let k = 1; k <= 6; k++) {
        for (const dir of [-1, 1]) {
          const tz = pz + dir * k * (span * 0.13);
          if (tz < z0 - 2 || tz > z1 + 2) continue;
          const dy = deck + H - deck, dz = tz - pz;
          const len = Math.hypot(dy, dz);
          cables.push([x + sx, deck + (H) / 2, (pz + tz) / 2, len, Math.atan2(dz, dy)]);
        }
      }
    }
  }
  const cGeo = new THREE.BoxGeometry(0.12, 1, 0.12);
  const cMesh = new THREE.InstancedMesh(cGeo, cableMat, cables.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  cables.forEach(([cx, cy, cz, len, ang], i) => {
    e.set(ang, 0, 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(1, len, 1));
    cMesh.setMatrixAt(i, m);
  });
  cMesh.instanceMatrix.needsUpdate = true;
  g.add(cMesh);
  trackQuality(cMesh, 'detail');

  // ── လက်ရန်း ───────────────────────────────────────────────────────
  for (const sx of [-width / 2, width / 2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, span + 2), steel);
    rail.position.set(x + sx, deck + 0.55, (z0 + z1) / 2);
    g.add(rail);
    room.colliders.push(new THREE.Box3(
      new THREE.Vector3(x + sx - 0.3, 0, z0 - 1),
      new THREE.Vector3(x + sx + 0.3, deck + 1.1, z1 + 1)));
  }
  return { deck, x, width };
}

// ============================================================
// ⛴️ **မြစ်ထဲက လှေ / သင်္ဘောများ**
//
// user: "မြစ်ထဲမှာ လှေများ သဘော်များရှိမယ်"
//
// ★ ဘတ်စ်ကား စနစ်ကိုပဲ ပြန်သုံးတယ် — `room.buses` ရဲ့ ပုံစံ အတူတူပဲမို့
//   `updateBuses` က လှေတွေကိုပါ ရွှေ့ပေးတယ်။ code ထပ်ရေးစရာ မလိုဘူး。
// ★ collider မထည့်ဘူး — လှေက ရေပေါ်မှာ, ကစားသမားက ကမ်းပေါ်မှာ။
//   ရေထဲ ဝင်လို့ မရတော့ ဘယ်တော့မှ မထိဘူး。
// ============================================================
const BOAT_KINDS = {
  /// ⛴️ ဒလ ကူးတို့ — အဖြူရောင် ခရီးသည်တင်
  ferry: { hull: [7, 2.2, 18], cabin: [5.5, 2.4, 9], colour: 0xe8eef5, roof: 0x2d6f9e, funnel: false },
  /// 🚢 ကုန်တင် သင်္ဘော — အနီရောင်, မီးခိုးခေါင်းတိုင် ပါ
  cargo: { hull: [11, 3.4, 40], cabin: [8, 4.5, 11], colour: 0x8a3b3b, roof: 0xd8dbe2, funnel: true },
  /// 🛶 သမ္ပန် — သစ်သားလှေ သေးသေး
  sampan: { hull: [2.4, 1.1, 8], cabin: [2, 1.1, 3], colour: 0x6b5a44, roof: 0x3f6b3a, funnel: false },
};

function makeBoat(kind) {
  const K = BOAT_KINDS[kind] || BOAT_KINDS.sampan;
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(...K.hull),
    new THREE.MeshStandardMaterial({ color: K.colour, roughness: 0.7, metalness: 0.15 }));
  hull.position.y = K.hull[1] / 2; g.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(...K.cabin),
    new THREE.MeshStandardMaterial({
      color: K.roof, emissive: 0x1a2a38, emissiveIntensity: 0.7, roughness: 0.55,
    }));
  cabin.position.set(0, K.hull[1] + K.cabin[1] / 2, -K.hull[2] * 0.12);
  g.add(cabin);
  if (K.funnel) {
    const fn = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.6 }));
    fn.position.set(0, K.hull[1] + K.cabin[1] + 2, -K.hull[2] * 0.12);
    g.add(fn);
  }
  return g;
}

/**
 * ⛴️ လှေ လမ်းကြောင်း တစ်ခု — ဘတ်စ်ကားလိုပဲ ပတ်တယ်。
 * @param o.kind — 'ferry' | 'cargo' | 'sampan'
 * @param o.y    — ရေမျက်နှာပြင် အမြင့် (မြစ်က ၀.၂)
 */
export function boatLine(room, { points, kind = 'sampan', count = 2,
                                 speed = 5, y = 0.2, stops = [] } = {}) {
  if (!points || points.length < 2) return;
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len, start: total });
    total += len;
  }
  const buses = [];
  for (let i = 0; i < count; i++) {
    const mesh = makeBoat(kind);
    mesh.position.y = y;
    room.group.add(mesh);
    trackQuality(mesh, 'detail');
    buses.push({ mesh, s: (total / count) * i, wait: 0, lockY: y });
  }
  (room.buses ||= []).push({ segs, total, buses, speed, stops, label: kind });
}
