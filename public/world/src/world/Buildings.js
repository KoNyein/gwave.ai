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
import { addDoor } from './Door.js';
import { occupancyGrid, boxesFromGrid, cutDoorway } from './Occupancy.js';

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
  /// 🚕 အငှားကား — ၂.၁ × ၂.၂ × ၄.၈ m (mesh ၆၀ → ၂၁, တြိဂံ ၁,၀၅၂)
  ///    ယာဉ်မောင်း ရုပ်ပါ ပါတယ် — ရပ်ထားချိန် ကားထဲမှာ လူရှိတယ်လို့
  ///    မြင်ရပြီး၊ ကိုယ်တိုင် မောင်းချိန်မှာလည်း avatar ကို ဖျောက်ထားလို့
  ///    ထပ်နေတာ မဖြစ်ဘူး။
  taxi: '/world/assets/taxi.glb',
};

/// 🚗 **စီးလို့ရတဲ့ kind များ** — မော်ဒယ်နှစ်ခုစလုံး ရှေ့က −Z မှာ ဆိုတော့
///    ၁၈၀° လှည့်တဲ့ အခွံ လိုတယ်၊ ပြီးရင် `room.cars` ထဲ ထည့်ရတယ်။
export const VEHICLE_LABELS = {
  pickup: '🛻 ပစ်ကပ်ကား',
  taxi: '🚕 အငှားကား',
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
  /// 🚪 အထဲ ဝင်လို့ရအောင် — { side, width, step }。 မပေးရင် အခိုင်အမာ
  ///    ဘောက်စ် တစ်ခုတည်း (ကား, အလှဆင် ပစ္စည်း အတွက် အဲဒါ မှန်တယ်)。
  hollow = null,
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
  const inner = gltf.scene.clone(true);
  // 🛻 ★ **ကား မော်ဒယ်ရဲ့ ရှေ့က −Z ဘက်** — မီးကြီး, ဂရစ်, ဘွန်နက်
  //    အားလုံး −Z မှာ (render ၂ ခု ဘေးချင်းယှဉ်ပြီး တိုင်းထားတယ်)。
  //    Vehicle.js က မော်ဒယ်ရှေ့ကို +Z လို့ ယူဆထားလို့ **ကားက နောက်ပြန်
  //    မောင်းပြီး ကွေ့တာလည်း ပြောင်းပြန်** ဖြစ်နေတယ်။ မော်ဒယ်ကို ၁၈၀°
  //    လှည့်ထားတဲ့ အခွံတစ်ခုထဲ ထည့်လိုက်တာက အသန့်ရှင်းဆုံး — အပြင်ဘက်က
  //    ကြည့်ရင် ကားရဲ့ ရှေ့က +Z ဖြစ်သွားပြီ၊ ကျန်တဲ့ code ဘာမှ မထိရဘူး။
  let obj = inner;
  if (VEHICLE_LABELS[kind]) {
    // ★ ဘယ်ဘက်က ရှေ့လဲ ဆိုတာ **မော်ဒယ်က ကိုယ်တိုင် ပြောတယ်** — ပစ်ကပ်ရဲ့
    //   extras မှာ `"forward": "-Z"` ပါတယ်။ မပါရင် −Z လို့ ယူဆတယ်
    //   (တက္ကစီမှာ မပါဘူး၊ ဒါပေမယ့် ရှေ့ဘီး ၂ လုံးက z −1.45 မှာ ရှိလို့
    //   −Z ဖြစ်တာ တိုင်းစစ်ပြီးသား)。
    const fwdAxis = inner.children[0]?.userData?.forward
                 || inner.userData?.forward || '-Z';
    obj = new THREE.Group();
    inner.rotation.y = fwdAxis === '+Z' ? 0 : Math.PI;
    obj.add(inner);
  }
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
    const box = new THREE.Box3().setFromObject(obj);
    box.min.y = 0;
    if (hollow) hollowShell(room, box, { ...hollow, object: obj });
    else room.colliders.push(box);
    // 🛻 ကားဆိုရင် **စီးလို့ရတဲ့ ယာဉ်** အဖြစ် စာရင်းသွင်း — VehicleSystem က
    //    အခန်းကူးတိုင်း `room.cars` ကို ဖတ်တယ် (async ရောက်လာလည်း မှီတယ်)。
    if (VEHICLE_LABELS[kind]) {
      const rig = rigVehicle(inner);
      (room.cars ||= []).push({
        mesh: obj, box, label: VEHICLE_LABELS[kind],
        doors: rig.doors, wheels: rig.wheels, wheelR: rig.radius,
        seat: rig.seat, camPose: rig.cam,
        head: rig.head, tail: rig.tail,
        // 🚕 မော်ဒယ်က ကိုယ်ပိုင် အချက်အလက် ပေးထားရင် ယူတယ် — တက္ကစီမှာ
        //    `{ seats: 4, fareBase: 500, farePerKm: 450 }` ပါလာတယ်။
        //    ★ extras က scene root မှာလား ပထမ child မှာလား ဆိုတာ
        //      loader/export ပေါ် မူတည်တယ် — နှစ်ခုစလုံး ပေါင်းယူတယ်။
        spec: { ...(inner.children[0]?.userData || {}), ...(inner.userData || {}) },
      });
    }
  }
  return obj;
}

/**
 * 🚗 **ကားရဲ့ ရွေ့လျားတဲ့ အစိတ်အပိုင်းများ** — ဘီး ၄ လုံး, တံခါး ၂ ချပ်
 *
 * user: "ကား တံခါး အဖွင့်အပိတ်" / ZIP ထဲက generator suite
 *
 * ★ မော်ဒယ် အသစ်မှာ **သတ်မှတ်ချက် (convention) ပါလာပြီ** — ခန့်မှန်းစရာ
 *   မလိုတော့ဘူး (`world-registry.json` က ဒီလို ပြောထားတယ်):
 *       WHEEL_FL/FR/RL/RR — ဘီး၊ pivot က ဝင်ရိုးမှာ, လည်ရိုး = local X
 *       DOOR_L / DOOR_R   — တံခါး၊ pivot က ပတ္တာမှာ
 *       SEAT_Driver/Pass* — ထိုင်ခုံ (ဆင်းတဲ့နေရာ တွက်ဖို့)
 *       CAM_Third         — နောက်ကလိုက် ကင်မရာ အနေအထား
 *
 * ★ အရင် မော်ဒယ်မှာ တံခါးက material နာမည် (`MAT_Interior_Trim`) နဲ့ပဲ
 *   ရှာလို့ရတယ်၊ pivot ကို လက်နဲ့ တွက်ရတယ် (x ±0.94, z −1.0)。 အခု
 *   မော်ဒယ်က pivot ကို ကိုယ်တိုင် ပေးထားတယ် — ပိုတိကျပြီး မော်ဒယ်
 *   ပြောင်းလည်း အလုပ်လုပ်တယ်。
 *
 * ★ `COL_*` node တွေလည်း ပါပေမယ့် **geometry မပါဘူး** (loader မှာ
 *   Object3D သက်သက် ဖြစ်နေတယ် — တိုင်းစစ်ပြီး တွေ့ခဲ့)。 ဒါကြောင့်
 *   collider ကို bounding box ကနေပဲ ဆက်ယူတယ် — ကားက ဘောက်စ်ပုံစံမို့
 *   အဲဒါနဲ့ လုံလောက်တယ်。
 */
function rigVehicle(root) {
  const wheels = [];
  const doors = [];
  const head = [], tail = [];
  let seat = null, cam = null;
  // 💡 **မီးများ** — ZIP ထဲက `vehicle-system.js` က `LIGHT_Head_L/R` နဲ့
  //    `LIGHT_Tail_L/R` ကို emissive တင်/ချ လုပ်တယ်။ မော်ဒယ် နှစ်မျိုးက
  //    နည်းနှစ်မျိုးနဲ့ ပေးထားတယ်:
  //      ပစ်ကပ် — material နာမည် (`MAT_Light_Head` / `MAT_Light_Tail`)
  //      တက္ကစီ — node နာမည် (`LIGHT_Head_*` / `LIGHT_Tail_*`)
  //    ဒါကြောင့် နှစ်မျိုးလုံး လက်ခံတယ်။
  // ★ material ကို **clone မဖြစ်မနေ လုပ်ရမယ်** — `scene.clone(true)` က
  //   material ကို မျှသုံးတယ်၊ မ clone ဘဲ emissive ပြောင်းရင် အဲဒီဖိုင်ကနေ
  //   ဆောက်ထားတဲ့ **ကားအားလုံး** ဘရိတ်မီး တစ်ပြိုင်နက် တောက်သွားမယ်။
  const lampsOf = (o) => {
    if (!o.isMesh || !o.material) return;
    const mn = o.material.name || '';
    let bucket = null;
    for (let q = o; q; q = q.parent) {
      const qn = q.name || '';
      if (qn.startsWith('LIGHT_Head')) { bucket = head; break; }
      if (qn.startsWith('LIGHT_Tail')) { bucket = tail; break; }
    }
    if (!bucket) {
      if (mn === 'MAT_Light_Head') bucket = head;
      else if (mn === 'MAT_Light_Tail') bucket = tail;
    }
    if (!bucket) return;
    o.material = o.material.clone();
    bucket.push(o.material);
  };
  root.traverse((o) => {
    lampsOf(o);
    const n = o.name || '';
    if (/^WHEEL_(FL|FR|RL|RR)$/.test(n)) {
      wheels.push({ node: o, front: n[6] === 'F', spin: 0 });
    } else if (n === 'DOOR_L' || n === 'DOOR_R') {
      // ★ မော်ဒယ်ထဲမှာ တံခါးက **ပိတ်ပြီးသား** ဖြစ်နေတယ် (အရင်ဟာက
      //   ပွင့်ပြီးသား)。 ပိတ်တာက ၀, ပွင့်တာက အပြင်ဘက် ၈၀°。
      const side = n === 'DOOR_L' ? -1 : 1;
      doors.push({ node: o, closed: 0, open: side * 1.4, angle: 0, target: 0 });
    } else if (n === 'SEAT_Driver') seat = o;
    else if (n === 'CAM_Third') cam = o;
  });
  // ဘီး အချင်းဝက် — ဝင်ရိုး အမြင့်ကနေ (မြေနဲ့ ထိတဲ့ အချက်)
  const radius = wheels.length ? Math.abs(wheels[0].node.position.y) || 0.38 : 0.38;
  // မီး မထွန်းခင် အခြေအနေကို မှတ်ထား — ပြန်ပိတ်တဲ့အခါ ဒီတန်ဖိုးကို ပြန်သွား
  for (const m of [...head, ...tail]) m.userData.baseEmissive = m.emissiveIntensity ?? 1;
  return { wheels, doors, radius, seat, cam, head, tail };
}

/**
 * 🚪 **အထဲ ဟာပြီး တံခါးပါတဲ့** collider အခွံ
 *
 * user: "တိုက်တွေ အိမ်တွေ ဝင်မရဘူး" / "အိမ်တံခါးတွေ လှပ်မရဘူး"
 *
 * ★ ဒါက ကျွန်တော့် အမှားကို ပြင်တာ။ အရင်က အိမ်တစ်လုံးလုံးကို AABB
 *   **တစ်ခုတည်း**နဲ့ ဖုံးထားတယ် — အဲဒါက "အထဲ ဟာတယ်၊ တံခါး ရှိတယ်"
 *   ဆိုတာကို ဖော်ပြလို့ မရဘူး၊ ဘောက်စ်ကြီး တစ်ခုပဲ ဖြစ်နေတယ်။
 *   တိုင်းတာချက်: အိမ်အလယ်မှာ ထားရင် **၉.၅–၁၁.၉ m တွန်းထုတ်**ခဲ့တယ်။
 *
 * ★ အခု နံရံ ၄ ချပ်ကို သီးသန့် box လုပ်ပြီး ရှေ့နံရံကို တံခါးဝနဲ့
 *   နှစ်ပိုင်း ခွဲတယ် — CityKit ရဲ့ shophouse နဲ့ တူညီတဲ့ နည်း
 *   (အဲဒီမှာ ဇယားကွက် တိုင်းပြီး သက်သေပြထားပြီး)。
 *
 * @param o.side  — တံခါး ဘယ်ဘက်မှာလဲ: '+x' | '-x' | '+z' | '-z'
 * @param o.width — တံခါးဝ အကျယ် (m)
 * @param o.step  — အထဲက ကြမ်းပြင် အမြင့် (ခြေတံရှည်အိမ်အတွက်)。 ၀ ဆိုရင်
 *                  လှေကား မလို။ ၀ ထက် ကြီးရင် တံခါးရှေ့မှာ လှေကားထစ်
 *                  ထုတ်ပေးတယ် — physics က ၀.၅၅ m အထိ တက်နိုင်လို့
 *                  အဲဒီအောက် ထစ်တွေ ခွဲထားတယ်။
 */
export function hollowShell(room, box, {
  side = '+z', width = 3, step = 0, wall = 0.5, object = null,
} = {}) {
  const { min, max } = box;
  const top = max.y;
  const push = (x0, z0, x1, z1, y0 = 0, y1 = top) => room.colliders.push(
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));

  const axisZ = side === '+z' || side === '-z';
  const cx = (min.x + max.x) / 2, cz = (min.z + max.z) / 2;

  // ခြေတံရှည်အိမ် — နံရံတွေက **ကြမ်းပြင် အထက်မှာမှ** စတယ်၊ အောက်က
  // အခန်းလွတ်က ဖြတ်လျှောက်လို့ ရရမယ် (တိုင်တွေပဲ ရှိတာ)。
  const wallBase = step > 0.05 ? step : 0;

  // ── ① နံရံ — မော်ဒယ်ရဲ့ **တကယ့် တြိဂံ**ကနေ ────────────────────────
  //
  // ★ ဒါက ကျွန်တော့် ဒုတိယ အမှားကို ပြင်တာ။ ပထမတစ်ခါက အိမ်တစ်လုံးလုံးကို
  //   box တစ်ခုနဲ့ ဖုံးမိလို့ **ဝင်လို့ မရ**ဖြစ်ခဲ့တယ်။ ပြင်တဲ့အခါ နံရံ ၄ ချပ်ကို
  //   bounding box ရဲ့ **အနား**မှာ ချလိုက်တယ် — ဒါက မော်ဒယ်ရဲ့ နံရံအစစ်
  //   ဘယ်မှာ ရှိတယ်ဆိုတာကို လုံးဝ မကြည့်ဘူး။
  //   တိုင်းတာချက် (မြဝတီ ခြေတံရှည်အိမ်): bounding box x[-50.0,-29.9] ဖြစ်ပြီး
  //   နံရံအစစ် (timber) က x[-44.1,-31.9] — collider က နံရံကနေ **၅.၉ m
  //   အပြင်မှာ**။ ဆိုလိုတာက အိမ်ရဲ့ နံရံအစစ်ကို ဖြတ်လျှောက်လို့ ရနေတယ်။
  //
  //   အခု တြိဂံတွေကို ဇယားကွက်ပေါ် ပုံနှိပ်ပြီး နံရံရှိတဲ့ အကွက်တိုင်းကို
  //   collider လုပ်တယ် — ပုံသဏ္ဌာန် အတိအကျ လိုက်တယ်၊ တံခါးဝနဲ့
  //   ပြတင်းပေါက်အောက် အလိုအလျောက် ပွင့်နေတယ်။
  let grid = null;
  let gap = null;
  if (object) {
    grid = occupancyGrid(object, {
      // ★ ၀.၃၅ m — တံခါးဝ ၁.၅ m လောက်ကို ၄ ကွက်နဲ့ ဖမ်းနိုင်တယ်။
      //   ၀.၅ ဆိုရင် ၂ ကွက်ပဲ ရပြီး နံရံက အပေါက်ထဲ တိုးဝင်လာလို့
      //   အဝင်လမ်း ကျဉ်းသွားတယ်။
      cell: 0.35,
      bandFrom: wallBase + 0.5,
      bandTo: wallBase + 1.7,
    });
    // 🚪 တံခါးဝ — box မထုတ်ခင် **ဖောက်ရမယ်**
    gap = cutDoorway(grid, side, Math.max(2.2, width));
    for (const b of boxesFromGrid(grid, { floorY: wallBase, minTop: 1.0 })) {
      room.colliders.push(b);
    }
    // 🪵 ခြေတံရှည်အိမ် — **အောက်က တိုင်တွေ**。 နံရံက ကြမ်းပြင် အထက်မှာ
    //    စလို့ အောက်ပိုင်းမှာ ဘာမှ မရှိခဲ့ဘူး — တိုင်တွေကို ဖြတ်လျှောက်
    //    လို့ ရနေတယ် (မျဉ်းဖြောင့် ပြေးစမ်းသပ်: ဘုရားသုံးဆူမှာ ခြေလှမ်း
    //    ၁၁၀ ခု တိုင်ထဲ ရောက်နေတယ်)。 တိုင်ကြားက ဆက်လျှောက်လို့ရတယ်။
    if (wallBase > 0.05) {
      const under = occupancyGrid(object, {
        cell: 0.5, bandFrom: 0.6, bandTo: Math.max(0.9, wallBase - 0.3),
      });
      // ★ **တိုင်ပါးပါးတွေကိုပဲ** ယူတယ် — အောက်ခြေ တစ်ခုလုံး မပိတ်ဘူး။
      //
      //   အောက်ကို မော်ဒယ်အတိုင်း အပြည့် ပိတ်ကြည့်ပြီးပြီ: ခြေတံရှည်အိမ်ရဲ့
      //   အောက် တစ်ခုလုံး `#` ဖြစ်သွားပြီး လျှောက်လို့ မရတော့ဘူး — ပြီးတော့
      //   "အထဲ ရောက်နေတဲ့ ခြေလှမ်း" တိုင်းချက်က **တက်သွား**တယ်
      //   (ဘုရားသုံးဆူ ၂၈၆ → ၄၅၉, မဲဆောက် ၃၃ → ၂၅၈)。
      //   ဆိုလိုတာက အဲဒီ တိုင်းချက်က "ဖောက်ထွင်းသွားတာ" မဟုတ်ဘဲ **နံရံနဲ့
      //   ကပ်ရပ်နေတာ**ကို ရေတွက်နေတာ (collider က အကွက်လိုက်၊ တြိဂံက
      //   အကွက်ထဲ ဝင်နေလို့)。 နံရံ ၄ ဘက်လုံးကို ပြေးတိုးတဲ့ စမ်းသပ်မှုက
      //   အမြဲ "တားရ" ပြနေတာမို့ ဖောက်ထွင်းမှု မရှိဘူးဆိုတာ သေချာတယ်။
      for (const b of boxesFromGrid(under, { floorY: 0, minTop: 0.9 })) {
        if (b.max.x - b.min.x > 0.8) continue;
        b.max.y = Math.min(b.max.y, wallBase);
        room.colliders.push(b);
      }
    }
  } else {
    // မော်ဒယ် မပါရင် (စမ်းသပ်မှု/အဟောင်း) — bounding box အခွံ
    for (const face of ['+x', '-x', '+z', '-z']) {
      const isDoor = face === side;
      if (face === '+z' || face === '-z') {
        const z0 = face === '+z' ? max.z - wall : min.z;
        const z1 = face === '+z' ? max.z : min.z + wall;
        if (!isDoor) { push(min.x, z0, max.x, z1, wallBase); continue; }
        push(min.x, z0, cx - width / 2, z1, wallBase);
        push(cx + width / 2, z0, max.x, z1, wallBase);
      } else {
        const x0 = face === '+x' ? max.x - wall : min.x;
        const x1 = face === '+x' ? max.x : min.x + wall;
        if (!isDoor) { push(x0, min.z, x1, max.z, wallBase); continue; }
        push(x0, min.z, x1, cz - width / 2, wallBase);
        push(x0, cz + width / 2, x1, max.z, wallBase);
      }
    }
  }

  // ── ② 🚪 တံခါး — ဖောက်ထားတဲ့ အပေါက်ကို ဖုံးအုပ် ─────────────────────
  const dx = gap ? gap.x : (side === '+x' ? max.x : side === '-x' ? min.x : cx);
  const dz = gap ? gap.z : (side === '+z' ? max.z : side === '-z' ? min.z : cz);
  const dw = gap ? gap.width : width;
  const dr = addDoor(room, {
    x: dx, z: dz, facing: gap ? gap.facing : side,
    width: Math.max(1.2, dw - 0.15), height: 2.3,
    label: '🚪 အိမ် တံခါး',
  });
  // ခြေတံရှည် — တံခါးက ကြမ်းပြင် အထက်မှာ ရှိရမယ်
  if (step > 0.05) {
    dr.pivot.position.y = step;
    dr.box.min.y = step; dr.box.max.y = step + 2.3;
    dr.position.y = step;
  }
  // လှေကားက တံခါးဝ ရှေ့မှာမှ ရှိရမယ် — မဟုတ်ရင် နံရံကို တက်ရမယ်
  const doorAt = axisZ ? dx : dz;

  // 🪜 ခြေတံရှည်အိမ် — အထဲက ကြမ်းပြင်က မြင့်နေလို့ လှေကား လိုတယ်
  if (step > 0.05) {
    // အထဲ ကြမ်းပြင် — **ပါးလွှာတဲ့ ခုံ** (၀ ကနေ မဟုတ်)。
    //
    // ★ ၀ → step အထိ တစ်တုံးလုံး ထားရင် physics က အဲဒါကို **နံရံ** လို့
    //   မှတ်တယ် (`b.max.y <= pos.y + 0.55` မဟုတ်လို့)。 ဒါဆို ခြေတံရှည်
    //   အိမ်ရဲ့ **အောက်က လျှောက်လို့ မရတော့ဘူး** — အဲဒါ ခြေတံရှည်အိမ်ရဲ့
    //   အဓိက သဘောကို ဖျက်တာ။ တိုင်းတာချက်: အလယ်မှာ ၉.၈၅ m တွန်းထုတ်။
    // ★ ပါးလွှာတဲ့ ခုံ ဆိုရင် အောက်မှာ ရပ်ချိန် `b.min.y >= pos.y + height`
    //   ဖြစ်လို့ **ခေါင်းပေါ်** အဖြစ် ကျော်သွားတယ် — အောက် လျှောက်လို့ရ၊
    //   လှေကားတက်ရင် အပေါ် ရပ်လို့ရ။
    //
    // ★ ကြမ်းပြင်က **နံရံအစစ်ရဲ့ အတွင်း**မှာမှ ရှိရမယ်။ bounding box
    //   ကနေ ယူရင် အိမ်ရဲ့ ၆ m အပြင်အထိ ကြမ်းပြင် ထွက်နေမယ် — လေထဲမှာ
    //   ရပ်လို့ ရနေမယ်။ occupancy grid ကနေ နံရံရဲ့ အစွန်း အစစ်ကို ယူတယ်။
    const f = grid ? gridFootprint(grid) : null;
    const fx0 = f ? f.minX : min.x + wall, fx1 = f ? f.maxX : max.x - wall;
    const fz0 = f ? f.minZ : min.z + wall, fz1 = f ? f.maxZ : max.z - wall;
    push(fx0 + wall, fz0 + wall, fx1 - wall, fz1 - wall, step - 0.2, step);
    // လှေကားထစ် — တစ်ထစ် ၀.၄ m (physics က ၀.၅၅ အထိ တက်နိုင်တယ်)
    // ★ တံခါးဝ ရှေ့မှာမှ — အလယ်မှာ ချရင် နံရံကို တက်ခိုင်းသလို ဖြစ်မယ်
    const n = Math.ceil(step / 0.4);
    for (let i = 1; i <= n; i++) {
      const y = (step * i) / n;
      const off = (n - i + 1) * 1.1;      // အောက်ထစ်လေ ရှေ့ထွက်လေ
      if (axisZ) {
        const z = side === '+z' ? fz1 + off : fz0 - off;
        push(doorAt - width / 2, z - 0.6, doorAt + width / 2, z + 0.6, 0, y);
      } else {
        const x = side === '+x' ? fx1 + off : fx0 - off;
        push(x - 0.6, doorAt - width / 2, x + 0.6, doorAt + width / 2, 0, y);
      }
    }
  }
}

/// occupancy grid ထဲက **တကယ် ရှိတဲ့** အကွက်တွေရဲ့ အစွန်း — မော်ဒယ်ရဲ့
/// bounding box မဟုတ်ဘူး (အဲဒါက အလှဆင် ပစ္စည်း/ခြံဝင်း အထိ ပါတတ်တယ်)。
function gridFootprint({ cols, rows, cell, minX, minZ, occ }) {
  let c0 = cols, c1 = -1, r0 = rows, r1 = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occ[r * cols + c]) continue;
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
      if (r < r0) r0 = r;
      if (r > r1) r1 = r;
    }
  }
  if (c1 < 0) return null;
  return {
    minX: minX + c0 * cell, maxX: minX + (c1 + 1) * cell,
    minZ: minZ + r0 * cell, maxZ: minZ + (r1 + 1) * cell,
  };
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

/**
 * 🛕🛕 **ရွှေတိဂုံ အစုအဝေး** — ရင်ပြင်ပေါ် တက်လို့ရအောင်
 *
 * user: "ရန်ကုန်မှာ ရအောင် ထည့်ပါ"
 *
 * ★ ဒါက PR #574 မှာ **ဖယ်ခဲ့ရတဲ့** မော်ဒယ်ပါ — ကစားကွင်း အပြင် ၂၅၀ m
 *   မှာ ရှိပြီး နယ်နိမိတ်နံရံက ကာထားလို့ ဘယ်တော့မှ မရောက်နိုင်လို့။
 *   အခု နံရံက terrain အစွန်း (၃၇၄ m) ကို ရွှေ့ပြီးပြီ (PR #576) ဆိုတော့
 *   **သွားလို့ရပြီ** — ကျန်တာက ရင်ပြင်ပေါ် တက်လမ်း ပေးဖို့ပါပဲ။
 *
 * ★ မော်ဒယ်ရဲ့ ပုံသဏ္ဌာန်ကို တိုင်းကြည့်တော့ (r အလိုက် အမြင့် ပရိုဖိုင်):
 *       r ၀–၁၃၀   → ရင်ပြင်က **y ၂၈ မှာ ပြားနေတယ်**
 *       r ၁၃၂     → **၂၈ m ချောက်** (မြေပြင် y ၀ ဆီ တစ်ခါတည်း ကျ)
 *   ဆိုလိုတာက မော်ဒယ်မှာ တက်စရာ လမ်း (collider လုပ်လို့ရတဲ့ ပုံစံနဲ့)
 *   မပါဘူး။ ဒါကြောင့် **လှေကား ကိုယ်တိုင် ဆောက်ပေးရတယ်** — တစ်ထစ်
 *   ၀.၅ m (physics က ၀.၅၅ အထိ တက်နိုင်တယ်)。
 *
 * @param o.deck     — ရင်ပြင် အမြင့် (တိုင်းထားတာ ၂၈)
 * @param o.stairAt  — လှေကား ဘယ်ဘက်လဲ ('+z' = မြို့ဘက်)
 * @param o.stairX   — လှေကားကို x ဘယ်လောက် ရွှေ့မလဲ。 ★ ရန်ကုန်မှာ x ၀ မှာ
 *                     မြို့လယ် စေတီ (r ၁၃.၆) က လမ်းပိတ်နေတယ် — တိုင်းတာ
 *                     ကြည့်တော့ z −၃၂ မှာ တားခံရတယ်。 x ၃၀ ဆို ကင်းတယ်။
 */
export function stupaColliders(room, object, {
  position = new THREE.Vector3(), deck = 28, stairAt = '+z', stairX = 0,
} = {}) {
  // ① ရင်ပြင် — **ပါးလွှာတဲ့ ခုံ**。 မော်ဒယ်ရဲ့ တကယ့် ပုံစံ လိုက်တယ်
  //    (စတုရန်း ဆိုရင် ထောင့်လေးနေရာမှာ လေထဲ ရပ်နေမယ်)。
  const deckGrid = occupancyGrid(object, {
    cell: 4, bandFrom: deck - 1.5, bandTo: deck + 0.5,
  });
  for (const b of boxesFromGrid(deckGrid, { floorY: deck - 0.2, minTop: 0 })) {
    b.max.y = deck;
    room.colliders.push(b);
  }

  // ② ရင်ပြင် အထက်က အရာအားလုံး — စေတီ, ထစ်ခွင်, စေတီငယ် = အခိုင်အမာ
  // ★ ၂ m အကွက် — ၄ m နဲ့ ဆိုရင် ရင်ပြင်ပတ်လည်က တန်ဆောင်း/စေတီငယ်
  //   အတန်းက **နံရံတစ်ခုလုံး** ဖြစ်သွားပြီး r ၈၀ မှာ ပိတ်မိတယ် (တိုင်းတာ
  //   ပြီး တွေ့ခဲ့)。 ၂ m ဆိုရင် သူတို့ကြားက လမ်းကြားတွေ ကျန်တယ် —
  //   တကယ့် ရွှေတိဂုံလိုပဲ စေတီတော်ကြီးအထိ ဝင်လို့ရတယ်။
  const upGrid = occupancyGrid(object, {
    cell: 2, bandFrom: deck + 0.8, bandTo: deck + 2.0,
  });
  // ★ **အလုံးကြီးတွေရဲ့ အထဲကို ဖြည့်ရမယ်**。 rasterise လုပ်တာက မျက်နှာပြင်ကို
  //   အမှတ်အသား လုပ်တာ ဖြစ်လို့ စေတီကြီးရဲ့ **အလယ်က ဗလာ ကျန်နေတယ်** —
  //   အလယ်မှာ ရပ်ကြည့်တော့ တွန်းအား ၀.၀၀ m (စေတီထဲ ရပ်လို့ရနေတယ်)。
  //   အမြင့် ကြီးတဲ့ (deck+15 ကျော်) အကွက်တွေကြားကိုပဲ ဖြည့်တယ် — ရင်ပြင်
  //   အလွတ်က မပါဘူး (အဲဒါ ဖြည့်ရင် ရင်ပြင်တစ်ခုလုံး ပိတ်သွားမယ်)。
  {
    const { cols, rows, occ, top } = upGrid;
    const TALL = deck + 15;
    for (let r = 0; r < rows; r++) {
      let lo = -1, hi = -1;
      for (let c = 0; c < cols; c++) {
        if (occ[r * cols + c] && top[r * cols + c] > TALL) { if (lo < 0) lo = c; hi = c; }
      }
      for (let c = lo; c >= 0 && c <= hi; c++) {
        if (!occ[r * cols + c]) { occ[r * cols + c] = 1; top[r * cols + c] = TALL; }
      }
    }
  }
  for (const b of boxesFromGrid(upGrid, { floorY: deck, minTop: 0.8 })) {
    room.colliders.push(b);
  }

  // ③ ကုန်း အနား — **၂၈ m ချောက်**။ collider မထားရင် ကုန်းထဲ လျှောက်ဝင်
  //    သွားလို့ရတယ် (တိုင်းတာချက်: z −၂၂၉ အထိ y ၀ နဲ့ ဖြတ်သွားခဲ့တယ်)。
  //    အနားက မျက်နှာပြင်ကိုပဲ rasterise တယ် — အလယ်က ဗလာ ကျန်လည်း
  //    ဝင်လို့ မရတော့ဘူး။ လှေကား လမ်းကြောင်းကိုတော့ ချန်ထားရမယ်။
  const sign = stairAt === '+z' ? 1 : -1;
  const rimGrid = occupancyGrid(object, { cell: 4, bandFrom: 1.5, bandTo: 3.5 });
  for (const b of boxesFromGrid(rimGrid, { floorY: 0, minTop: 0 })) {
    const inStairX = b.max.x > position.x + stairX - 9 && b.min.x < position.x + stairX + 9;
    const onStairSide = sign > 0 ? b.max.z > position.z + 110 : b.min.z < position.z - 110;
    if (inStairX && onStairSide) continue;      // လှေကား ဝင်ပေါက် ချန်
    b.max.y = deck;
    room.colliders.push(b);
  }

  // ④ 🪜 လှေကား — မြေပြင်ကနေ ရင်ပြင်အထိ (တကယ့် ရွှေတိဂုံလို ရှည်တယ်)
  // ★ လှေကား တစ်ခုလုံး **ရင်ပြင် အပြင်ဘက်မှာ** ရှိရမယ် (ရင်ပြင်က r ၁၃၀
  //   အထိ)。 အထဲ ဝင်နေရင် ခြေထောက် ၂၇.၀ မှာ ရှိချိန် ရင်ပြင် (၂၈) က
  //   `max.y <= pos.y + 0.55` မဖြစ်လို့ **နံရံ** အဖြစ် တားပြီး ထစ် ဆက်တက်
  //   လို့ မရဘူး (တိုင်းတာချက်: z −၁၂၂, y ၂၇ မှာ ရပ်တန့်)。
  const R = 130;
  const RISE = 0.5, TREAD = 1.2, W = 7;
  const n = Math.ceil(deck / RISE);
  for (let i = 1; i <= n; i++) {
    const y = (deck * i) / n;
    const z0 = position.z + sign * (R + (n - i + 1) * TREAD);
    const z1 = z0 + sign * TREAD;
    room.colliders.push(new THREE.Box3(
      new THREE.Vector3(position.x + stairX - W, 0, Math.min(z0, z1)),
      new THREE.Vector3(position.x + stairX + W, y, Math.max(z0, z1)),
    ));
  }
  // ★ ထိပ်ပြင် — လှေကားထိပ် (r ၁၃၁) နဲ့ ရင်ပြင် (r ≤ ၁၃၀) ကြား မဟာနေစေရ။
  //   ၁၃၂ ကနေ စခဲ့တုန်းက ၃ m ဟာပြီး အပေါ်ရောက်တာနဲ့ ၂၈ → ၀ ပြန်ကျခဲ့တယ်။
  //   ★ ထိပ်ထစ်ရဲ့ အတွင်းအနားနဲ့ **အတိအကျ ဆက်ရမယ်** — ကျော်ထားရင်
  //     အောက်ထစ်တွေကို ဖုံးပြီး နံရံ ဖြစ်သွားတယ် (၂၈ က ၂၇.၀ ကနေ ၀.၅၅
  //     ကျော်နေလို့)。 အဲဒီအမှားနဲ့ z −၁၁၆, y ၂၇ မှာ ရပ်သွားခဲ့တယ်။
  {
    const outer = position.z + sign * (R + TREAD);   // ထိပ်ထစ် အတွင်းအနား
    const inner = position.z + sign * (R - 14);      // ရင်ပြင်ထဲ ၁၄ m
    room.colliders.push(new THREE.Box3(
      new THREE.Vector3(position.x + stairX - W, 0, Math.min(inner, outer)),
      new THREE.Vector3(position.x + stairX + W, deck, Math.max(inner, outer)),
    ));
  }
}

/**
 * 🛕 စေတီ ရင်ပြင် — **ပေါ်တက်လို့ရအောင်** collider
 *
 * user: "စေတီပေါ် တက်မရဘူး"
 *
 * အရင်က စေတီတစ်ခုလုံးကို ၂၃×၂၃×၂၆ ဘောက်စ် တစ်ခုနဲ့ ဖုံးထားတယ် —
 * တိုင်းတာချက်: အလယ်မှာ ထားရင် **၁၁.၈၅ m တွန်းထုတ်**။ ပေါ်တက်လို့
 * မရတာ ထားဦး၊ အနားတောင် မကပ်နိုင်ဘူး။
 *
 * အခု:
 *   · ရင်ပြင် (၁.၂ m မြင့်) = **နင်းလို့ရတဲ့ ကြမ်းပြင်**
 *   · ရင်ပြင် ပေါ်တက်ဖို့ လှေကားထစ် ၃ ထစ် (physics က ၀.၅၅ m အထိ တက်နိုင်)
 *   · ထစ်ခွင်နဲ့ ခေါင်းလောင်း = အခိုင်အမာ (တကယ့် စေတီမှာလည်း မတက်ရဘူး)
 */
export function pagodaColliders(room, position = new THREE.Vector3(), scale = 1) {
  const { x, z } = position;
  const S = scale;
  const push = (r, y0, y1) => room.colliders.push(new THREE.Box3(
    new THREE.Vector3(x - r * S, y0 * S, z - r * S),
    new THREE.Vector3(x + r * S, y1 * S, z + r * S)));

  // ရင်ပြင် — **ပါးလွှာတဲ့ ခုံ**。 ၀ ကနေ ထားရင် နံရံဖြစ်ပြီး ခြေလှမ်း
  // မတက်နိုင်တော့ဘူး (ခြေတံရှည်အိမ် ကြမ်းပြင်နဲ့ တူညီတဲ့ အကြောင်းရင်း)。
  push(13.6, 1.0, 1.2);
  // 🪜 လှေကား ၃ ထစ် — တောင်ဘက်က တက်တယ် (spawn ဘက်)
  for (let i = 1; i <= 3; i++) {
    const y = (1.2 * i) / 3;
    const off = 13.6 + (4 - i) * 1.2;
    room.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 3 * S, 0, z + (off - 1.2) * S),
      new THREE.Vector3(x + 3 * S, y * S, z + off * S)));
  }
  // ထစ်ခွင် ၄ ဆင့် + ခေါင်းလောင်း — အခိုင်အမာ
  let y = 1.2;
  for (const [r, h] of [[11.0, 1.9], [9.4, 1.7], [7.8, 1.5], [6.2, 1.3]]) {
    push(r, y, y + h); y += h;
  }
  push(5.0, y, y + 7.0);   // ခေါင်းလောင်း
}
