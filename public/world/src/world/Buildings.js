// ============================================================
// Buildings.js — လောကထဲက **အဆောက်အအုံ အစစ်** များ (GLB)
//
// user: "ဒီ file တွေကို metaverse မှာ အသေးစိတ် ထည့်ပါ …
//        home နဲ့ စေတီကို metaverse မှာ နေရာချပါ"
//
// ═══ တင်ထားတဲ့ ဖိုင် နှစ်ခုကို ဘာလို့ ဒီမှာ ထားလဲ ═══
//
// ★ နှစ်ခုလုံး **လူ မဟုတ်ဘူး** — GLB ကို ဖတ်ကြည့်တော့ bone ၀, skinned mesh
//   ၀, animation ၀。 ဒါကြောင့် avatar စာရင်း (`REALISTIC_FILES`) ထဲ
//   မထည့်ဘူး — အဆောက်အအုံ အဖြစ် လောကထဲ နေရာချတယ်။
//   (လူ ရုပ်တစ်ခု တင်ရင်တော့ `public/metaverse/realistic/` ထဲ ထည့်ပြီး
//    main.js ရဲ့ REALISTIC_FILES မှာ စာရင်းသွင်းရမယ်။)
//
// ═══ ဖိုင်တွေကို ဘာလုပ်ထားလဲ ═══
//
// မူရင်း GLB နှစ်ခုက **mesh ထောင်ချီ** ပါလာတယ် — mesh တစ်ခုက draw call
// တစ်ခု ဖြစ်လို့ ဖုန်းမှာ ရိုက်ချိုးပစ်မယ့် အရေအတွက်:
//     ထင်းအိမ်       mesh   ၅၁၃ → **၉**    (၁.၁၀ MB → ၀.၅၄ MB)
//     ကိုလိုနီ အိမ်   mesh ၂,၁၀၃ → **၉**    (၅.၆၂ MB → ၂.၇၉ MB)
// material အလိုက် geometry တွေ ပေါင်း၊ ထပ်နေတဲ့ vertex တွေ weld လုပ်ပြီး
// ပြန် export လုပ်ထားတယ်။ ပုံပန်းသဏ္ဌာန် မပြောင်း — texture မပါလို့
// (vertex/material အရောင်ချည်းပဲ) ပေါင်းလိုက်တာ အရောင် မထိခိုက်ဘူး။
//
// ★ **Async** — `loadGLB` က promise ကို cache လုပ်တယ်၊ အခန်းက အဆောက်အအုံ
//   မရောက်ခင်ကတည်းက ဆောက်ပြီးသား ဖြစ်နေတယ်။ ရောက်မှ ထည့်တယ် (collider
//   ပါ အဲဒီအချိန်မှ ထည့်တယ် — `room.colliders` array က physics ဆီ
//   reference အနေနဲ့ သွားထားလို့ နောက်ကျ ထည့်လည်း အလုပ်လုပ်တယ်)。
// ============================================================

import * as THREE from 'three';
import { loadGLB } from '../core/Assets.js';
import { trackQuality } from '../core/Quality.js';

export const BUILDINGS = {
  /// 🛕 ရွှေတိဂုံပုံစံ စေတီတော် အစုအဝေး — ၂၆၄ × ၁၂၆ × ၂၆၄ m
  ///
  /// ★ တင်လာတဲ့ မူရင်းက **၃၀.၉ MB / mesh ၇,၁၆၈ / တြိဂံ ၆၈၇,၄၉၂** —
  ///   အဲဒီအတိုင်း ဖုန်းကို ပို့ရင် ရိုက်ချိုးသွားမယ်။ ဒါကြောင့်:
  ///     · material အလိုက် ပေါင်း          mesh ၇,၁၆၈ → ၁၀
  ///     · diagonal ၂m အောက် အလှဆင် အစိတ်အပိုင်း ဖယ်
  ///     · လူအုပ် (skin/cloth/monk_robe) ဖယ် — ကိုယ့်မှာ လမ်းလျှောက်တဲ့
  ///       NPC အစစ် ရှိပြီးသား၊ ဒီဟာတွေက အရိုးမပါလို့ မလှုပ်ဘူး
  ///   ရလဒ်: **၃.၃၄ MB / တြိဂံ ၁၅၅,၈၄၄** (mesh ၅,၃၇၂ ဖယ်ခဲ့တယ်)。
  ///   အဝေးက ကြည့်ရင် မူရင်းနဲ့ ကွာခြားချက် မမြင်ရဘူး (နှိုင်းယှဉ် render
  ///   လုပ်ပြီး စစ်ထားတယ်)。
  stupa: '/world/assets/golden_stupa.glb',
  /// 🛖 မြန်မာ့ ရိုးရာ ထင်းအိမ် (ခြေတံရှည်) — ၂၀ × ၇ × ၂၀ m
  stilt: '/world/assets/stilt_house.glb',
  /// 🏛️ ကိုလိုနီခေတ် သုံးထပ်တိုက် — ၁၈ × ၁၄ × ၁၉ m
  colonial: '/world/assets/colonial_house.glb',
  /// 🛻 ပစ်ကပ် ကား — ၄.၁ × ၁.၉ × ၅.၄ m (mesh ၁၂၈ → ၁၁, တြိဂံ ၂,၇၂၄)
  pickup: '/world/assets/pickup.glb',
};

/**
 * အဆောက်အအုံ တစ်လုံးကို အခန်းထဲ ချထားတယ်။
 *
 * @param {Room} room
 * @param {object} o
 *   o.kind     — 'stilt' | 'colonial'
 *   o.position — THREE.Vector3 (မြေပြင်ပေါ်၊ y က အလိုအလျောက်)
 *   o.rotation — radian (Y ဝင်ရိုး)
 *   o.scale    — default ၁
 *   o.collide  — collider ထည့်မလား (default true)
 * @returns {Promise<THREE.Object3D|null>}
 */
export async function addBuilding(room, {
  kind = 'stilt',
  position = new THREE.Vector3(),
  rotation = 0,
  scale = 1,
  collide = true,
  /// 🎚️ ဂရပ်ဖစ် အဆင့် — 'heavy' က အလယ်ကတည်းက ဖျောက်တယ်၊
  ///    'detail' က အနိမ့်မှ ဖျောက်တယ်။
  tier = 'detail',
  /// 🎨 material တစ်ခုကို အရောင် ပြောင်း — { name, color }。
  ///    ကားတွေကို အရောင်စုံ ထားဖို့ (တစ်လုံးတည်း ဖိုင်ကနေ)。
  paint = null,
} = {}) {
  const url = BUILDINGS[kind];
  if (!url) return null;
  let gltf;
  try {
    gltf = await loadGLB(url);
  } catch {
    // ★ ဖိုင် မရရင် အခန်းက ဆက်အလုပ်လုပ်ရမယ် — လောကတစ်ခုလုံး မရပ်စေရ
    return null;
  }
  // ★ cache က gltf တစ်ခုတည်းကို ပြန်ပေးတယ် — အလုံးနှစ်လုံး ချရင်
  //   clone မလုပ်ဘဲ ထည့်လိုက်ရင် ဒုတိယတစ်လုံးက ပထမကို ဆွဲရွှေ့သွားမယ်။
  //   အရိုးမပါလို့ ရိုးရိုး clone နဲ့ လုံလောက်တယ် (SkeletonUtils မလို)。
  const obj = gltf.scene.clone(true);
  obj.position.copy(position);
  // 📐 ၃ စင်တီ မြှင့် — မော်ဒယ်ရဲ့ ကိုယ်ပိုင် မြေခုံနဲ့ အခန်းကြမ်းပြင်
  //    z-fight မဖြစ်အောင်
  obj.position.y += 0.03;
  obj.rotation.y = rotation;
  obj.scale.setScalar(scale);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;     // 🔋 ဖုန်း — အဆောက်အအုံ အရိပ် မလို
    o.receiveShadow = false;
    // 🎨 ★ clone() က material ကို **မျှသုံး**တယ် — အရောင် ပြောင်းရင်
    //   အဲဒီ ဖိုင်ကနေ ဆောက်ထားတဲ့ အားလုံး လိုက်ပြောင်းသွားမယ်။ ဒါကြောင့်
    //   ပြောင်းမယ့် material ကိုပဲ သီးသန့် clone လုပ်ရတယ်။
    if (paint && o.material && o.material.name === paint.name) {
      o.material = o.material.clone();
      o.material.color.setHex(paint.color);
    }
  });
  room.group.add(obj);
  obj.updateMatrixWorld(true);
  trackQuality(obj, tier);

  if (collide) {
    // ★ Collider က **အပြင်ခွံ တစ်ခုတည်း** — အထဲက mesh ၉ ခုစီ box
    //   လုပ်ရင် ကစားသမား ဝရံတာပေါ် တက်လို့ ရသွားပြီး ထူးဆန်းမယ်၊
    //   physics loop ကလည်း box ပိုစစ်ရမယ်။
    const box = new THREE.Box3().setFromObject(obj);
    // မြေခုံ အောက် အနည်းငယ် ချ — ခြေထောက် ငုတ်မသွားအောင်
    box.min.y = 0;
    room.colliders.push(box);
  }
  return obj;
}

/**
 * 🛕 စေတီ — မြန်မာ့ ပုံစံ ထစ်ခွင် အောက်ခြေ + ခေါင်းလောင်း + ထီးတော်
 *
 * အရင်က စေတီက **ဆလင်ဒါ တစ်ခု + ကွန်း တစ်ခု** ပဲ — ဝေးကနေ ကြည့်ရင်
 * ခေါင်းစွပ် တစ်ခုလို ဖြစ်နေတယ်။ အခု ထစ်ခွင် ၄ ဆင့်, ခေါင်းလောင်းပိုင်း,
 * ငှက်မြတ်နား, ထီးတော်, ရွှေရောင် အလင်း — ဒါပေမယ့် အားလုံး procedural မို့
 * ဖိုင် တစ်ခုမှ မဆွဲဘူး (mesh ~၁၀, တြိဂံ ~၁,၅၀၀)。
 *
 * @returns {THREE.Group}
 */
export function buildPagoda({ position = new THREE.Vector3(), scale = 1 } = {}) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xf5c542, metalness: 0.85, roughness: 0.22,
    emissive: 0x5a3f00, emissiveIntensity: 0.35,
  });
  const goldDark = new THREE.MeshStandardMaterial({
    color: 0xc9a13b, metalness: 0.8, roughness: 0.32,
  });
  const marble = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.8 });

  // ① ကျောက်ပြား ရင်ပြင် — လူသွားလာလို့ရတဲ့ အောက်ခြေ
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 1.2, 16), marble);
  plinth.position.y = 0.6;
  g.add(plinth);

  // ② ထစ်ခွင် အောက်ခြေ ၄ ဆင့် — အပေါ်သွားလေ သေးလေ
  const tiers = [
    { r0: 11.0, r1: 9.6, h: 1.9 },
    { r0: 9.4, r1: 8.0, h: 1.7 },
    { r0: 7.8, r1: 6.4, h: 1.5 },
    { r0: 6.2, r1: 5.0, h: 1.3 },
  ];
  let y = 1.2;
  for (const t of tiers) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(t.r1, t.r0, t.h, 16), goldDark);
    m.position.y = y + t.h / 2;
    g.add(m);
    y += t.h;
  }

  // ③ ခေါင်းလောင်းပိုင်း — စေတီရဲ့ အထင်ရှားဆုံး အပိုင်း
  const bell = new THREE.Mesh(new THREE.SphereGeometry(4.9, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), gold);
  bell.position.y = y;
  bell.scale.y = 1.35;
  g.add(bell);
  y += 4.9 * 1.35;

  // ④ ပလ္လင် + ငှက်မြတ်နာ — ခေါင်းလောင်းနဲ့ ထီးကြား ကျဉ်းတဲ့ အပိုင်း
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.0, 1.4, 16), goldDark);
  band.position.y = y + 0.7; g.add(band); y += 1.4;
  const lotus = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.6, 16), gold);
  lotus.position.y = y + 1.3; g.add(lotus); y += 2.6;

  // ⑤ ထီးတော် — ကွန်း ရှည်ရှည် + ထိပ်ဖျား စိန်
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.5, 11, 12), gold);
  spire.position.y = y + 5.5; g.add(spire); y += 11;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({
    color: 0xfff3c4, metalness: 0.5, roughness: 0.05,
    emissive: 0xffd166, emissiveIntensity: 1.2,
  }));
  gem.position.y = y + 0.9; g.add(gem);

  // ⑥ အလင်း — ညမှာ ရွှေရောင် ထွက်အောင်
  const glow = new THREE.PointLight(0xffcc44, 70, 70);
  glow.position.y = y * 0.55;
  g.add(glow);

  g.position.copy(position);
  g.scale.setScalar(scale);
  g.updateMatrixWorld(true);
  return g;
}
