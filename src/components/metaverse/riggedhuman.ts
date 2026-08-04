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

  let mixer: THREE.AnimationMixer | null = null;
  const actions = new Map<string, THREE.AnimationAction>();
  let current = "";
  let disposed = false;
  let model: THREE.Group | null = null;

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

  /// Clip ကူးပြောင်း — crossfade လေးနဲ့ ချောချော
  function play(name: string, fade = 0.18) {
    if (name === current) return;
    const next = actions.get(name);
    if (!next) return;
    const prev = actions.get(current);
    next.reset().play();
    if (prev) next.crossFadeFrom(prev, fade, false);
    current = name;
  }

  function update(dt: number, s: HumanState) {
    if (!mixer) return;
    if (s.speed > 5) play("sprint");
    else if (s.speed > 0.15) play("walk");
    else if (s.emote === "wave") play("emote-yes");
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
    attach: { head: ph(), torso: ph(), hips: ph(), footL: ph(), footR: ph(), handR },
    attachments: [],
    materials,
    update,
    dispose,
  };
}
