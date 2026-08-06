import * as THREE from "three";
import type { Avatar, HumanState } from "./human";

/// 🎖 Rigged NPC — kit character GLB (animation clip ၂၇ ခုပါ) ကို arena
/// ရဲ့ ဓားပြ NPC တွေအတွက် **တကယ့် animation** နဲ့ ပြတယ်: idle / walk /
/// sprint / holding-right (သေနတ်ကိုင်ဟန်) crossfade။
///
/// ★ ဘာလို့ NPC တွေမှာပဲလဲ — player avatar က ရုပ်ပြင်ခန်း (အရောင်/အဝတ်/
///   ကိုယ်ခန္ဓာ customize) နဲ့ ချိတ်ထားတဲ့ procedural human ဖြစ်လို့
///   GLB နဲ့ အစားထိုးရင် customization ပျက်မယ်။ NPC က ရုပ်သေမို့
///   GLB ရဲ့ ပိုကောင်းတဲ့ animation ကို အပြည့်သုံးလို့ရတယ်။
/// ★ `Avatar` interface အပြည့် လိုက်နာတယ် — remotes pipeline (lerp/
///   nametag/setHandWeapon/dispose) က လူသား/ခွေး/rigged ခွဲစရာမလိုဘူး။
/// ★ GLB က async ဆွဲတယ် — မရောက်ခင် group က ဗလာ (ခဏပဲ)၊ ရောက်ရင်
///   ပေါ်လာတယ်။ Loader ကို dynamic import — arena မဝင်တဲ့သူ bundle ထဲ
///   GLTFLoader မပါစေနဲ့။

/// Kenney kit character — bind-pose က raw ~9 unit မြင့်လို့ 0.2 စကေး
/// (gwave-city ရုပ်တုတွေနဲ့ တူညီတဲ့ တွက်ချက်မှု)၊ root က မြေအောက်စူးလို့
/// +1 ပြန်တင်တယ်။
const KIT_SCALE = 0.2;
const KIT_Y = 1;

/// ရနိုင်တဲ့ character variant အားလုံး (character-a.glb … character-r.glb)
export const SOLDIER_VARIANTS = "abcdefghijklmnopqr".split("");

/// Player id ကနေ တည်ငြိမ်တဲ့ variant ရွေး — တစ်ယောက်တည်းက ဘယ် client
/// ကကြည့်ကြည့် ရုပ်တူနေဖို့ (hash → variant)။
export function soldierVariantFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return SOLDIER_VARIANTS[h % SOLDIER_VARIANTS.length] ?? "a";
}

export function createRiggedHuman(variant: string): Avatar {
  const group = new THREE.Group();

  const inner = new THREE.Group();
  inner.scale.setScalar(KIT_SCALE);
  inner.position.y = KIT_Y;
  group.add(inner);

  /// ညာလက် weapon attach — arm-right bone ရဲ့ လက်ဖျားခန့်မှာ။ Inner က
  /// 0.2 စကေးမို့ weapon mesh တွေ (world အရွယ်ဆောက်ထား) မသေးသွားအောင်
  /// ပြန်ချဲ့ထားတယ်။
  const handR = new THREE.Group();
  handR.position.set(0, -2.2, 0.4);
  handR.scale.setScalar(1 / KIT_SCALE);

  // Avatar interface ပြည့်ဖို့ placeholder joint များ — NPC မှာ ဦးထုပ်/
  // အဝတ် attach မလုပ်လို့ scene ထဲမထည့်ဘဲ ထားတယ်
  const ph = () => new THREE.Object3D();
  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: 0xe8b088 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x3f4652 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b3038 }),
  };

  /// 🧬 Scan-face attach point — model load ပြီးမှ head bone ထဲ ဝင်တယ်။
  /// Load မပြီးခင် plate တပ်ထားရင်လည်း group ထဲ စောင့်နေပြီး head ရောက်မှ
  /// အတူပေါ်တယ် (scanface.ts က attach.head ကိုပဲ သုံးလို့)။
  const headAttach = new THREE.Group();
  /// 🧍 Body morphs (scan) — bones ရောက်မှ တပ်မယ့် queue
  let pendingMorphs: Record<string, number> | null = null;

  /// Anatomy-approximate bone scaling: scan morph weights → skeleton။
  /// Kit rig ရဲ့ bone နာမည်တွေ (arm-left/right, leg-left/right, head,
  /// torso) ကို တွေ့သလောက် scale တယ် — GLB asset မှာ morph target မပါလို့
  /// အနီးစပ်ဆုံး ကိုယ်နေဟန်ထား ပြောင်းလဲမှု။
  const applyMorphs = (m: Record<string, number>) => {
    if (!model) {
      pendingMorphs = m;
      return;
    }
    const w = (k: string) => Math.max(-1, Math.min(1, Number(m[k]) || 0));
    inner.scale.setScalar(KIT_SCALE * (1 + w("height") * 0.08));
    const grab = (n: string) => model?.getObjectByName(n) ?? null;
    const head = grab("head");
    if (head) head.scale.setScalar(1 + w("headScale") * 0.15);
    for (const n of ["arm-left", "arm-right"]) {
      const b = grab(n);
      if (b) b.scale.y = 1 + w("armLength") * 0.12;
    }
    for (const n of ["leg-left", "leg-right"]) {
      const b = grab(n);
      if (b) b.scale.y = 1 + w("legLength") * 0.12;
    }
    const torso = grab("torso") ?? model;
    if (torso) {
      torso.scale.x = 1 + w("shoulderWidth") * 0.14;
      torso.scale.z = 1 + (w("waist") + w("weight")) * 0.08;
    }
  };
  group.userData.setMorphs = applyMorphs;

  let mixer: THREE.AnimationMixer | null = null;
  const actions = new Map<string, THREE.AnimationAction>();
  let current = "";
  let disposed = false;
  let model: THREE.Group | null = null;
  /// One-shot clip (ပစ်ဟန်/ဓားဝှေ့/သေ) ပြနေချိန် — locomotion မဖျက်စေနဲ့
  let oneShotUntil = 0;

  /// 🔫 One-shot clip — ပစ်တိုင်း `holding-right-shoot`၊ ဓားဆို
  /// `attack-melee-right`၊ သေရင် `die` (holdMs နဲ့ အလောင်းပုံ ဆက်ထား)။
  /// Avatar interface ကို မချဲ့ဘဲ group.userData ကနေ ပေးတယ် — dog/
  /// procedural avatar တွေမှာ မရှိလို့ caller က optional chaining နဲ့ ခေါ်။
  const playClip = (name: string, holdMs = 0) => {
    if (!mixer) return;
    const a = actions.get(name);
    if (!a) return;
    const prev = actions.get(current);
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    if (prev && prev !== a) a.crossFadeFrom(prev, 0.06, false);
    current = name;
    oneShotUntil = performance.now() + a.getClip().duration * 1000 + holdMs - 60;
  };
  group.userData.playClip = playClip;

  void import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }) => {
    if (disposed) return;
    new GLTFLoader().load(
      `/metaverse/kits/characters/character-${variant}.glb`,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene as THREE.Group;
        inner.add(model);
        const arm = model.getObjectByName("arm-right");
        if (arm) arm.add(handR);
        // 🧬 Head bone — scan face plate နေရာ (bone မတွေ့ရင် model root)
        const headBone =
          model.getObjectByName("head") ??
          model.getObjectByName("Head") ??
          model;
        headBone.add(headAttach);
        if (pendingMorphs) {
          applyMorphs(pendingMorphs);
          pendingMorphs = null;
        }
        mixer = new THREE.AnimationMixer(model);
        for (const clip of gltf.animations) {
          actions.set(clip.name, mixer.clipAction(clip));
        }
        play("idle");
      },
      undefined,
      () => {
        /* ဆွဲမရရင် ဗလာ — nametag နဲ့ weapon ကတော့ ပေါ်နေသေးလို့
           game logic မပျက်ဘူး (server-authoritative) */
      },
    );
  });

  /// Clip ကူးပြောင်း — fadeIn/fadeOut (crossFadeFrom က ရပ်ပြီးသား
  /// one-shot action ကနေ ပြန်ကူးရင် snap ဖြစ်တတ်လို့)။ Loop settings ကို
  /// playClip က LoopOnce ပြောင်းထားနိုင်လို့ ပြန်သတ်မှတ်တယ်။
  function play(name: string, fade = 0.18) {
    if (name === current) return;
    const next = actions.get(name);
    if (!next) return;
    const prev = actions.get(current);
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    next.fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    current = name;
  }

  function update(dt: number, s: HumanState) {
    if (!mixer) return;
    // One-shot ပြနေချိန် locomotion မလွှမ်း — ပြီးမှ ပြန်ဆက်တယ်
    if (performance.now() < oneShotUntil) {
      mixer.update(dt);
      return;
    }
    if (s.speed > 5) play("sprint");
    else if (s.speed > 0.15) play("walk");
    else if (s.emote === "wave") play("emote-yes");
    else if (s.emote === "dance")
      play(actions.has("dance") ? "dance" : "emote-yes");
    else if (s.emote === "sit") play("sit");
    else if (s.armed) play("holding-right");
    else play("idle");
    mixer.update(dt);
  }

  function dispose() {
    disposed = true;
    mixer?.stopAllAction();
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) for (const mm of m) mm.dispose();
        else m?.dispose();
      }
    });
    materials.skin.dispose();
    materials.cloth.dispose();
    materials.dark.dispose();
  }

  return {
    group,
    attach: { head: headAttach, torso: ph(), hips: ph(), footL: ph(), footR: ph(), handR },
    attachments: [],
    materials,
    update,
    dispose,
  };
}
