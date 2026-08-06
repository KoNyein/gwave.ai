import * as THREE from "three";
import type { Avatar, HumanState } from "./human";

/// 🧍 Realistic human — Mixamo-rigged GLB (Soldier / Michelle / X Bot) ကို
/// player + NPC body အဖြစ် သုံးတယ်။ User: "cartoon တွေလုံးအစား —
/// ဒီလို (Mixamo) avatar တွေပဲ သုံးမယ်"။
///
/// ★ Asset — three.js examples ရဲ့ Mixamo characters (Vanguard soldier,
///   Michelle, X Bot) — public/metaverse/realistic/ မှာ self-host။
/// ★ Hybrid animation — GLB ထဲ locomotion clip ရှိရင် (Soldier/Xbot:
///   idle/walk/run) mixer crossfade သုံးတယ်၊ emote (wave/sit) က mixer
///   update ပြီးမှ bone quaternion ပေါ် ထပ်မြှောက်တဲ့ **overlay** —
///   clip asset မလိုဘူး။ Michelle မှာ locomotion clip မပါလို့ rpmavatar
///   ပုံစံ procedural sine locomotion အပြည့် သုံးတယ် (dance ကတော့ သူ့
///   SambaDance clip အစစ်)။
/// ★ Variant a-r — base ၃ မျိုး × tint — id တူရင် client တိုင်း ရုပ်တူ။
/// ★ `Avatar` interface အပြည့် — remotes pipeline / scanface / morphs /
///   createPlayerBody (RPM swap) အကုန် ဒီအတိုင်း ဆက်အလုပ်လုပ်တယ်။

const HEIGHT = 1.78;
const BASE = "/metaverse/realistic";

type Spec = { file: string; tint: number | null };

/// Variant table — remy (男 ပုံမှန်ဝတ်စုံ — user ပေး Mixamo FBX ကနေ
/// ပြောင်းထား)၊ soldier (arena/စစ်ဝတ်စုံ)၊ michelle (女)၊ xbot (mannequin)
/// ကို tint နဲ့ ခွဲထားတယ်။ Arena bot variants (b/c/j) က soldier ရုပ်။
const SPECS: Record<string, Spec> = {
  a: { file: "Remy", tint: null },
  b: { file: "Soldier", tint: 0x9fb4c8 },
  c: { file: "Soldier", tint: 0xa8c89f },
  d: { file: "Michelle", tint: null },
  e: { file: "Remy", tint: 0xc8b49f },
  f: { file: "Michelle", tint: 0x9fb4c8 },
  g: { file: "Xbot", tint: null },
  h: { file: "Remy", tint: 0x9fd0ff },
  i: { file: "Xbot", tint: 0x9fd0ff },
  j: { file: "Soldier", tint: 0xc8a89f },
  k: { file: "Michelle", tint: 0xa8c89f },
  l: { file: "Xbot", tint: 0xffe49f },
  m: { file: "Soldier", tint: null },
  n: { file: "Michelle", tint: 0x9fc8c0 },
  o: { file: "Remy", tint: 0xa8c89f },
  p: { file: "Soldier", tint: 0x8f9fae },
  q: { file: "Michelle", tint: 0xd8c8b8 },
  r: { file: "Xbot", tint: 0xd0b0ff },
};

/// Studio ရဲ့ ရုပ်ရွေးခန်းအတွက် variant စာရင်း (id + base + tint)
export const REALISTIC_VARIANTS = Object.entries(SPECS).map(([id, s]) => ({
  id,
  file: s.file,
  tint: s.tint,
}));

const B = (n: string) => `mixamorig:${n}`;

export function createRealisticHuman(variant: string): Avatar {
  const spec = SPECS[variant] ?? SPECS.a!;
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);

  const headAttach = new THREE.Group();
  const handR = new THREE.Group();
  const ph = () => new THREE.Object3D();
  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: 0xe8b088 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x3f4652 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b3038 }),
  };

  let disposed = false;
  let model: THREE.Group | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  /// clip name (lowercase) → action
  const actions = new Map<string, THREE.AnimationAction>();
  let current = "";
  let baseScale = 1;
  let pendingMorphs: Record<string, number> | null = null;

  type Bones = Record<
    | "hips" | "spine" | "head" | "legL" | "legR" | "shinL" | "shinR"
    | "armL" | "armR" | "foreL" | "foreR",
    THREE.Object3D | null
  >;
  let bones: Bones | null = null;
  /// bind-pose quats — Michelle (clip မရှိ) ရဲ့ procedural locomotion အတွက်
  const base = new Map<THREE.Object3D, THREE.Quaternion>();
  let hipsBaseY = 0;
  let phase = 0;

  const applyMorphs = (m: Record<string, number>) => {
    if (!model) {
      pendingMorphs = m;
      return;
    }
    const w = (k: string) => Math.max(-1, Math.min(1, Number(m[k]) || 0));
    inner.scale.setScalar(baseScale * (1 + w("height") * 0.08));
    const head = model.getObjectByName(B("Head"));
    if (head) head.scale.setScalar(1 + w("headScale") * 0.12);
    for (const n of ["LeftArm", "RightArm"]) {
      const b = model.getObjectByName(B(n));
      if (b) b.scale.y = 1 + w("armLength") * 0.1;
    }
    for (const n of ["LeftUpLeg", "RightUpLeg"]) {
      const b = model.getObjectByName(B(n));
      if (b) b.scale.y = 1 + w("legLength") * 0.1;
    }
    const spine = model.getObjectByName(B("Spine"));
    if (spine) {
      spine.scale.x = 1 + w("shoulderWidth") * 0.12;
      spine.scale.z = 1 + (w("waist") + w("weight")) * 0.08;
    }
  };
  group.userData.setMorphs = applyMorphs;
  // arena playClip callers (ပစ်ဟန်/သေဟန် kit clips) — ဒီ GLB တွေမှာ မပါလို့
  // no-op ဖြစ်အောင် လက်ခံထား (optional chaining callers မကျိုးအောင်)
  group.userData.playClip = () => undefined;

  void import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }) => {
    if (disposed) return;
    new GLTFLoader().load(
      `${BASE}/${spec.file}.glb`,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene as THREE.Group;
        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.frustumCulled = false; // skinned mesh pop-out ကာ
            // Tint — variant ခွဲမြင်ရအောင် (material က load တစ်ခါစီ fresh)
            if (spec.tint !== null) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              for (const m of mats) {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.color.multiply(new THREE.Color(spec.tint));
                }
              }
            }
          }
        });
        inner.add(model);

        // ~1.78m + ခြေဖဝါး မြေပေါ်
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner);
        const h = box.max.y - box.min.y;
        if (h > 0.01) {
          inner.scale.setScalar(HEIGHT / h);
          baseScale = inner.scale.x;
          inner.updateMatrixWorld(true);
          const box2 = new THREE.Box3().setFromObject(inner);
          const gpos = new THREE.Vector3();
          group.getWorldPosition(gpos);
          inner.position.y += gpos.y - box2.min.y;
        }

        const g = (n: string) => model?.getObjectByName(B(n)) ?? null;
        bones = {
          hips: g("Hips"),
          spine: g("Spine1") ?? g("Spine"),
          head: g("Head"),
          legL: g("LeftUpLeg"),
          legR: g("RightUpLeg"),
          shinL: g("LeftLeg"),
          shinR: g("RightLeg"),
          armL: g("LeftArm"),
          armR: g("RightArm"),
          foreL: g("LeftForeArm"),
          foreR: g("RightForeArm"),
        };
        for (const b of Object.values(bones)) {
          if (b) base.set(b, b.quaternion.clone());
        }
        hipsBaseY = bones.hips?.position.y ?? 0;
        bones.head?.add(headAttach);
        g("RightHand")?.add(handR);

        mixer = new THREE.AnimationMixer(model);
        for (const clip of gltf.animations) {
          actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
        }
        if (pendingMorphs) {
          applyMorphs(pendingMorphs);
          pendingMorphs = null;
        }
        play("idle");
      },
      undefined,
      () => {
        /* ဆွဲမရရင် ဗလာ — nametag/logic ဆက်အလုပ်လုပ်တယ် */
      },
    );
  });

  function play(name: string, fade = 0.22) {
    if (name === current) return;
    const next = actions.get(name);
    if (!next) return;
    const prev = actions.get(current);
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    current = name;
  }

  /// mixer update **ပြီးမှ** bone ပေါ် ထပ်မြှောက် — clip pose ပေါ် emote လွှမ်း
  const over = (bone: THREE.Object3D | null, x: number, y = 0, z = 0) => {
    if (!bone) return;
    bone.quaternion.multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)),
    );
  };
  /// bind-pose ကနေ ပြန်စပြီး လှည့် — clip မရှိတဲ့ body (Michelle) အတွက်
  const rot = (bone: THREE.Object3D | null, x: number, y = 0, z = 0) => {
    if (!bone) return;
    const q = base.get(bone);
    if (!q) return;
    bone.quaternion
      .copy(q)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
  };

  /// rpmavatar-style sine locomotion — clip မပါတဲ့ GLB အတွက်
  function procedural(dt: number, s: HumanState) {
    if (!bones) return;
    const moving = s.speed > 0.15;
    const run = s.speed > 5;
    if (moving) {
      const rate = run ? 11 : 7;
      const amp = run ? 0.85 : 0.55;
      phase += dt * rate * (s.backward ? -1 : 1);
      const sw = Math.sin(phase);
      const sw2 = Math.sin(phase + Math.PI);
      rot(bones.legL, sw * amp);
      rot(bones.legR, sw2 * amp);
      rot(bones.shinL, Math.max(0, -sw) * amp * 1.2);
      rot(bones.shinR, Math.max(0, -sw2) * amp * 1.2);
      rot(bones.armL, sw2 * amp * 0.7);
      rot(bones.armR, sw * amp * 0.7);
      rot(bones.spine, 0.06, 0, Math.sin(phase * 2) * 0.03);
      if (bones.hips) {
        bones.hips.position.y =
          hipsBaseY + Math.abs(Math.sin(phase)) * (run ? 0.05 : 0.03);
      }
    } else if (s.emote === "wave") {
      phase += dt * 6;
      rot(bones.armR, 0, 0, -2.4);
      rot(bones.foreR, 0, 0, Math.sin(phase) * 0.5 - 0.3);
      rot(bones.armL, 0);
      rot(bones.legL, 0);
      rot(bones.legR, 0);
      if (bones.hips) bones.hips.position.y = hipsBaseY;
    } else if (s.emote === "sit") {
      rot(bones.legL, -1.45);
      rot(bones.legR, -1.45);
      rot(bones.shinL, 1.4);
      rot(bones.shinR, 1.4);
      rot(bones.armL, -0.4);
      rot(bones.armR, -0.4);
      if (bones.hips) bones.hips.position.y = hipsBaseY - 0.35;
    } else {
      phase += dt * 1.6;
      const br = Math.sin(phase) * 0.02;
      rot(bones.legL, 0);
      rot(bones.legR, 0);
      rot(bones.shinL, 0);
      rot(bones.shinR, 0);
      rot(bones.armL, 0, 0, 0.06 + br);
      rot(bones.armR, 0, 0, -0.06 - br);
      rot(bones.spine, br);
      rot(bones.foreL, 0);
      rot(bones.foreR, 0);
      if (bones.hips) bones.hips.position.y = hipsBaseY;
    }
  }

  function update(dt: number, s: HumanState) {
    if (!model) return;
    const dance = s.emote === "dance";
    // 💃 Dance clip အစစ် ရှိရင် (Michelle SambaDance) အဲဒါကိုပဲ ပြ
    if (dance && actions.has("sambadance")) {
      play("sambadance");
      mixer?.update(dt);
      return;
    }
    if (!actions.has("idle")) {
      // clip-less body (Michelle idle/walk) — procedural အပြည့်
      if (dance) {
        phase += dt * 8;
        rot(bones?.armL ?? null, 0, 0, 1.6 + Math.sin(phase) * 0.6);
        rot(bones?.armR ?? null, 0, 0, -1.6 - Math.sin(phase + 1) * 0.6);
        rot(bones?.spine ?? null, 0, Math.sin(phase * 0.5) * 0.25, 0);
        if (bones?.hips) {
          bones.hips.position.y = hipsBaseY + Math.abs(Math.sin(phase)) * 0.05;
        }
        return;
      }
      procedural(dt, s);
      return;
    }
    // clip locomotion — idle/walk/run crossfade
    if (s.speed > 5) play("run");
    else if (s.speed > 0.15) play("walk");
    else play("idle");
    mixer?.update(dt);
    // emote overlay — clip pose ပေါ် ထပ်မြှောက် (idle နေချိန်သာ)
    if (s.speed <= 0.15) {
      if (s.emote === "wave") {
        phase += dt * 6;
        over(bones?.armR ?? null, 0, 0, -2.1);
        over(bones?.foreR ?? null, 0, 0, Math.sin(phase) * 0.5 - 0.3);
      } else if (dance) {
        phase += dt * 8;
        over(bones?.armL ?? null, 0, 0, 1.4 + Math.sin(phase) * 0.5);
        over(bones?.armR ?? null, 0, 0, -1.4 - Math.sin(phase + 1) * 0.5);
        over(bones?.spine ?? null, 0, Math.sin(phase * 0.5) * 0.2, 0);
      } else if (s.emote === "sit") {
        over(bones?.legL ?? null, -1.45);
        over(bones?.legR ?? null, -1.45);
        over(bones?.shinL ?? null, 1.4);
        over(bones?.shinR ?? null, 1.4);
        if (bones?.hips) bones.hips.position.y = hipsBaseY - 0.35;
      }
    }
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
