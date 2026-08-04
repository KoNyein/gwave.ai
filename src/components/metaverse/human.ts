import * as THREE from "three";

/// Procedural လူရုပ် — GLB မလိုဘဲ code နဲ့ဆောက်တယ်။
///
/// ဘာလို့ GLB မသုံးလဲ — asset တစ်ခုက ဖုန်း data နဲ့ဆို ၂-၅ MB၊ Mae Sot ဘက်က
/// network မှာ ပထမဆုံးဝင်တဲ့သူက ဒါကို စောင့်ရမယ်။ Primitive နဲ့ဆောက်ရင် 0 byte
/// download နဲ့ ချက်ချင်းပေါ်တယ်၊ အရောင်ကို player တစ်ယောက်ချင်း ပြောင်းလို့ရတယ်။
/// GLB avatar က နောက်မှ ထပ်ထည့်လို့ရတဲ့ layer (NEXT_PUBLIC_AVATAR_GLB)၊
/// မလာရင် ဒီလူရုပ်နဲ့ပဲ ဆက်အလုပ်လုပ်ရမယ် — ဘယ်တော့မှ ရပ်မသွားစေရ။

export type HumanState = {
  /// unit/second — 0 ဆို idle, 4 လောက်ဆို walk, 8 လောက်ဆို run
  speed: number;
  running: boolean;
  airborne: boolean;
  emote: "wave" | "dance" | "sit" | null;
  /// ★ နောက်ပြန်လျှောက်နေလား (back-pedal) — arena မှာ ကိုယ်လုံးက ချိန်ရာဘက်
  /// မျက်နှာမူထားပြီး နောက်ပြန်ဆုတ်တဲ့အခါ ခြေလှမ်း cycle ကို ပြောင်းပြန်
  /// ဖွင့်ရမယ်။ မဟုတ်ရင် ရှေ့လှမ်းနေတဲ့ခြေနဲ့ နောက်ဆုတ်နေတဲ့ moonwalk
  /// ဖြစ်ပြီး "ကိုယ်ဟန် မှားနေတယ်" လို့ မြင်ရတယ်။
  backward?: boolean;
};

export type Avatar = {
  group: THREE.Group;
  /// ★ အဝတ်/ဆံပင်/ပစ္စည်းတွေကို ကပ်ရမယ့်နေရာ (Phase 15)။ **အဆစ်မှာပဲ
  /// ကပ်ရမယ်** — group ပေါ်တင် ကပ်လိုက်ရင် animation လုပ်တဲ့အခါ ဦးထုပ်က
  /// လေထဲမှာ ကျန်နေပြီး ခေါင်းက ရွေ့သွားမယ်။
  attach: {
    head: THREE.Object3D;
    torso: THREE.Object3D;
    hips: THREE.Object3D;
    footL: THREE.Object3D;
    footR: THREE.Object3D;
  };
  /// လက်ရှိ ကပ်ထားတဲ့ အစိတ်အပိုင်းများ — config ပြောင်းရင် ဖယ်ပြီး dispose
  attachments: THREE.Object3D[];
  /// အသားရောင်/အဝတ်ရောင် ပြောင်းဖို့ (material ကို မျှသုံးထားတယ်)
  materials: { skin: THREE.MeshStandardMaterial; cloth: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial };
  update(dt: number, state: HumanState): void;
  dispose(): void;
};

/// အဆစ်တစ်ခုချင်းရဲ့ အလျား (unit)။ လူတစ်ယောက် ~1.75 unit မြင့်တယ်။
const LEN = {
  torso: 0.52,
  neck: 0.08,
  upperArm: 0.28,
  foreArm: 0.26,
  thigh: 0.44,
  shin: 0.42,
  foot: 0.2,
} as const;

const HIP_HEIGHT = 0.92;

/// Exponential smoothing — target ဆီကို dt အလိုက် ချောချောဆွဲတယ်။
///
/// ★ ဒါက animation state ကူးတာ ညင်သာစေတဲ့ အဓိကအချက်။ walk ကနေ run ကို
/// ချက်ချင်းခုန်ရင် ဆွဲသလိုဖြစ်တယ်၊ ဒီနည်းနဲ့ဆို frame ၅-၆ ခုနဲ့ ချောချော
/// ကူးသွားတယ်။ `k` မြင့်လေ မြန်လေ။ dt နဲ့ frame-rate independent ဖြစ်တယ်။
function approach(cur: number, target: number, dt: number, k = 12): number {
  return cur + (target - cur) * Math.min(1, k * dt);
}

/// အဆစ်တစ်ခု — pivot က အပေါ်၊ mesh က အောက်။
///
/// ★ mesh ကို `-length/2` ရွှေ့ထားရတယ်။ မရွှေ့ရင် BoxGeometry ရဲ့ဗဟိုက
/// pivot ဖြစ်နေပြီး၊ လက်ကို လှည့်လိုက်ရင် ပခုံးကနေမဟုတ်ဘဲ လက်အလယ်ကနေ
/// လှည့်သွားမယ် — ကျိုးနေသလို မြင်ရမယ်။
function joint(
  parent: THREE.Object3D,
  y: number,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  length: number,
  x = 0,
  z = 0,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  g.add(mesh);
  parent.add(g);
  return g;
}

export function createHuman(clothColor = 0x3f88c5, skinColor = 0xe8b088): Avatar {
  const group = new THREE.Group();

  // Material ၃ မျိုးပဲသုံးတယ် — draw call နည်းလေ ဖုန်းအဟောင်းမှာ ကောင်းလေ။
  const skin = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.85,
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: clothColor,
    roughness: 0.75,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x2b3038,
    roughness: 0.8,
  });

  // Geometry တွေကို ဘယ်/ညာ မျှသုံးတယ် — တစ်ခုဆောက်ပြီး ၂ ခါသုံး။
  const gTorso = new THREE.BoxGeometry(0.42, LEN.torso, 0.24);
  const gHead = new THREE.SphereGeometry(0.145, 16, 12);
  const gUpperArm = new THREE.BoxGeometry(0.12, LEN.upperArm, 0.13);
  const gForeArm = new THREE.BoxGeometry(0.105, LEN.foreArm, 0.115);
  const gThigh = new THREE.BoxGeometry(0.16, LEN.thigh, 0.17);
  const gShin = new THREE.BoxGeometry(0.14, LEN.shin, 0.15);
  const gFoot = new THREE.BoxGeometry(0.16, 0.09, LEN.foot);

  // ── အရိုးစု ─────────────────────────────────────────────────────────────
  // root → hips → torso → { head, ပခုံး → လက်မောင်း → လက်ရင်း }
  //             → ပေါင် → ခြေသလုံး → ခြေဖျား
  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  group.add(hips);

  const torso = joint(hips, 0, gTorso, cloth, -LEN.torso);
  // torso က pivot အောက်မဟုတ်ဘဲ အပေါ်တက်ရမယ်လို့ mesh ကို +ဘက်ရွှေ့ထား
  (torso.children[0] as THREE.Mesh).position.y = LEN.torso / 2;

  const head = new THREE.Group();
  head.position.y = LEN.torso + LEN.neck;
  const headMesh = new THREE.Mesh(gHead, skin);
  headMesh.castShadow = true;
  head.add(headMesh);
  torso.add(head);

  const shoulderY = LEN.torso - 0.06;
  const armL = joint(torso, shoulderY, gUpperArm, cloth, LEN.upperArm, 0.27);
  const armR = joint(torso, shoulderY, gUpperArm, cloth, LEN.upperArm, -0.27);
  const foreL = joint(armL, -LEN.upperArm, gForeArm, skin, LEN.foreArm);
  const foreR = joint(armR, -LEN.upperArm, gForeArm, skin, LEN.foreArm);

  const thighL = joint(hips, 0, gThigh, dark, LEN.thigh, 0.11);
  const thighR = joint(hips, 0, gThigh, dark, LEN.thigh, -0.11);
  const shinL = joint(thighL, -LEN.thigh, gShin, dark, LEN.shin);
  const shinR = joint(thighR, -LEN.thigh, gShin, dark, LEN.shin);

  const footL = new THREE.Group();
  footL.position.y = -LEN.shin;
  const footLMesh = new THREE.Mesh(gFoot, dark);
  footLMesh.position.set(0, -0.045, LEN.foot / 2 - 0.06);
  footL.add(footLMesh);
  shinL.add(footL);

  const footR = new THREE.Group();
  footR.position.y = -LEN.shin;
  const footRMesh = new THREE.Mesh(gFoot, dark);
  footRMesh.position.set(0, -0.045, LEN.foot / 2 - 0.06);
  footR.add(footRMesh);
  shinR.add(footR);

  // ── Animation state ─────────────────────────────────────────────────────
  let phase = 0; // ခြေလှမ်း cycle
  let breathe = 0; // idle အသက်ရှူ
  let emoteT = 0; // emote အချိန်
  let lastEmote: HumanState["emote"] = null;

  function update(dt: number, state: HumanState) {
    const speed = Math.max(0, state.speed);
    const moving = speed > 0.15;

    // ★ Emote က ရွှေ့လိုက်တာနဲ့ အလိုအလျောက်ရပ်ရမယ် — မရပ်ရင် လမ်းလျှောက်ရင်း
    // လက်ဝှေ့နေတဲ့ လူရုပ်ဖြစ်နေမယ်။
    const emote = moving || state.airborne ? null : state.emote;
    if (emote !== lastEmote) {
      emoteT = 0;
      lastEmote = emote;
    }
    emoteT += dt;

    // ခြေလှမ်း cycle က speed နဲ့အချိုးကျ — မြန်လေ ခြေလှမ်းသိပ်လေ။
    // နောက်ပြန်ဆုတ်ရင် cycle ပြောင်းပြန် (HumanState.backward ရဲ့ မှတ်ချက်)။
    phase += dt * (moving ? 2.2 + speed * 0.85 : 0) * (state.backward ? -1 : 1);
    breathe += dt * 1.6;

    const sw = Math.sin(phase);
    const cw = Math.cos(phase);
    const run = state.running && speed > 5;
    const amp = moving ? Math.min(1, speed / (run ? 8 : 4.2)) : 0;

    // ── ခြေထောက် ──────────────────────────────────────────────────────────
    let thighLT = sw * (run ? 0.95 : 0.62) * amp;
    let thighRT = -sw * (run ? 0.95 : 0.62) * amp;
    // ★ ဒူးက ရှေ့ဘက်သာ ကွေးရမယ် — max(0, ...) မထည့်ရင် ဒူးက နောက်ပြန်
    // ကွေးပြီး ခြေထောက် ကျိုးနေသလို ဖြစ်မယ်။
    let shinLT = Math.max(0, -sw) * (run ? 1.5 : 0.95) * amp;
    let shinRT = Math.max(0, sw) * (run ? 1.5 : 0.95) * amp;

    // ── လက် ── ခြေဝဲရှေ့ရင် လက်ယာရှေ့ (တစ်ဖက်စီ ဆန့်ကျင်)
    let armLT = -sw * (run ? 1.05 : 0.55) * amp;
    let armRT = sw * (run ? 1.05 : 0.55) * amp;
    let foreLT = run ? -1.15 : -0.25 - Math.max(0, sw) * 0.35 * amp;
    let foreRT = run ? -1.15 : -0.25 - Math.max(0, -sw) * 0.35 * amp;

    let torsoPitch = run ? 0.22 * amp : 0.04 * amp;
    let torsoRoll = cw * 0.05 * amp;
    let hipsY = HIP_HEIGHT + Math.abs(sw) * (run ? 0.08 : 0.035) * amp;
    const headPitch = run ? -0.12 : 0;
    let headYaw = 0;

    if (state.airborne) {
      // ── ခုန် ── ခြေကွေးတင်၊ လက်မြှောက်
      thighLT = 0.55;
      thighRT = 0.3;
      shinLT = 0.9;
      shinRT = 0.5;
      armLT = -1.9;
      armRT = -1.9;
      foreLT = -0.5;
      foreRT = -0.5;
      torsoPitch = 0.1;
      hipsY = HIP_HEIGHT;
    } else if (!moving) {
      // ── idle ── အသက်ရှူ + ခေါင်းလှုပ်
      const b = Math.sin(breathe) * 0.5 + 0.5;
      hipsY = HIP_HEIGHT + b * 0.012;
      torsoPitch = 0.02 + b * 0.02;
      armLT = -0.06;
      armRT = -0.06;
      foreLT = -0.16;
      foreRT = -0.16;
      thighLT = 0;
      thighRT = 0;
      shinLT = 0;
      shinRT = 0;
      headYaw = Math.sin(breathe * 0.33) * 0.16;

      if (emote === "wave") {
        // လက်ယာ မြှောက်ပြီး ဝှေ့
        armRT = -2.5;
        foreRT = -0.5 + Math.sin(emoteT * 9) * 0.55;
        headYaw = 0.12;
      } else if (emote === "dance") {
        const d = emoteT * 6.5;
        hipsY = HIP_HEIGHT + Math.abs(Math.sin(d)) * 0.09;
        torsoRoll = Math.sin(d) * 0.22;
        armLT = -1.6 + Math.sin(d) * 0.7;
        armRT = -1.6 - Math.sin(d) * 0.7;
        foreLT = -1.1;
        foreRT = -1.1;
        thighLT = Math.sin(d) * 0.25;
        thighRT = -Math.sin(d) * 0.25;
        headYaw = Math.sin(d * 0.5) * 0.3;
      } else if (emote === "sit") {
        hipsY = HIP_HEIGHT - 0.42;
        thighLT = 1.5;
        thighRT = 1.5;
        shinLT = 1.5;
        shinRT = 1.5;
        armLT = -0.35;
        armRT = -0.35;
        foreLT = -0.6;
        foreRT = -0.6;
        torsoPitch = 0.06;
      }
    }

    // ── target ဆီကို ချောချောဆွဲ ────────────────────────────────────────
    const k = state.airborne ? 18 : 14;
    hips.position.y = approach(hips.position.y, hipsY, dt, 10);
    torso.rotation.x = approach(torso.rotation.x, torsoPitch, dt, k);
    torso.rotation.z = approach(torso.rotation.z, torsoRoll, dt, k);
    head.rotation.x = approach(head.rotation.x, headPitch, dt, k);
    head.rotation.y = approach(head.rotation.y, headYaw, dt, 6);
    armL.rotation.x = approach(armL.rotation.x, armLT, dt, k);
    armR.rotation.x = approach(armR.rotation.x, armRT, dt, k);
    foreL.rotation.x = approach(foreL.rotation.x, foreLT, dt, k);
    foreR.rotation.x = approach(foreR.rotation.x, foreRT, dt, k);
    thighL.rotation.x = approach(thighL.rotation.x, thighLT, dt, k);
    thighR.rotation.x = approach(thighR.rotation.x, thighRT, dt, k);
    shinL.rotation.x = approach(shinL.rotation.x, -shinLT, dt, k);
    shinR.rotation.x = approach(shinR.rotation.x, -shinRT, dt, k);
    // ခြေဖျားက မြေပြင်နဲ့ အနီးစပ်ဆုံး ပြားနေအောင်
    footL.rotation.x = approach(footL.rotation.x, shinLT * 0.4, dt, k);
    footR.rotation.x = approach(footR.rotation.x, shinRT * 0.4, dt, k);
  }

  function dispose() {
    // ★ Geometry နဲ့ material က GPU memory — garbage collector က မရှင်းပေးဘူး။
    // Player ထွက်ဝင်များတဲ့ world မှာ ဒါမလုပ်ရင် memory တက်နေမယ်။
    for (const g of [
      gTorso,
      gHead,
      gUpperArm,
      gForeArm,
      gThigh,
      gShin,
      gFoot,
    ]) {
      g.dispose();
    }
    for (const m of [skin, cloth, dark]) m.dispose();
    group.removeFromParent();
  }

  return {
    group,
    attach: { head, torso, hips, footL, footR },
    attachments: [],
    materials: { skin, cloth, dark },
    update,
    dispose,
  };
}
