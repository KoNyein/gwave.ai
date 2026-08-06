import * as THREE from "three";

import type { Avatar, HumanState } from "./human";
import { createRiggedHuman } from "./riggedhuman";

/// 📸 Ready Player Me avatar (Phase: photo-real avatars)။
///
/// User ရဲ့ selfie ကနေ RPM က ထုတ်ပေးတဲ့ **rigged GLB** (မျက်နှာစစ်စစ်ပါ)
/// ကို metaverse ရဲ့ player body အဖြစ် သုံးတယ်။ RPM rig က Mixamo-style
/// standard bone names (Hips / Spine / Head / LeftUpLeg…) မို့ animation
/// clip asset မလိုဘဲ **procedural locomotion** (sine-based walk/run/idle/
/// emote) နဲ့ လှုပ်ရှားတယ် — clip library ထည့်ရင် နောက်မှ upgrade လုပ်လို့ရ။
///
/// ★ `createPlayerBody` — kit rig နဲ့ စပြီး rpmUrl ရောက်မှ **နေရာတွင်
///   အစားထိုး** လို့ရတဲ့ wrapper။ Scene က `me`/remote ကို closure တွေထဲ
///   ကိုင်ထားလို့ Avatar object identity မပြောင်းဘဲ အထဲက ကိုယ်ထည်ကိုပဲ
///   လဲတယ် (group child swap)။
/// ★ Scan-face plate က RPM body မှာ **မလို** (မျက်နှာက GLB ထဲ ပါပြီးသား)
///   — `group.userData.noScanFace` နဲ့ scanface.ts ကို ကျော်ခိုင်းတယ်။

const RPM_HEIGHT = 1.78;

type Bones = {
  hips: THREE.Object3D | null;
  spine: THREE.Object3D | null;
  head: THREE.Object3D | null;
  legL: THREE.Object3D | null;
  legR: THREE.Object3D | null;
  shinL: THREE.Object3D | null;
  shinR: THREE.Object3D | null;
  armL: THREE.Object3D | null;
  armR: THREE.Object3D | null;
  foreL: THREE.Object3D | null;
  foreR: THREE.Object3D | null;
};

export function createRpmHuman(url: string): Avatar {
  const group = new THREE.Group();
  group.userData.noScanFace = true;

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
  let bones: Bones | null = null;
  /// bind-pose quaternions — procedural rotation တွေက ဒီပေါ် ထပ်မြှောက်
  const base = new Map<THREE.Object3D, THREE.Quaternion>();
  let hipsBaseY = 0;
  let phase = 0;

  void import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }) => {
    if (disposed) return;
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            (o as THREE.Mesh).frustumCulled = false; // skinned mesh pop-out ကာ
          }
        });
        // ~1.78m၊ ခြေဖဝါး မြေပေါ်
        const box = new THREE.Box3().setFromObject(model);
        const h = box.max.y - box.min.y;
        if (h > 0.01) model.scale.setScalar(RPM_HEIGHT / h);
        model.updateMatrixWorld(true);
        const box2 = new THREE.Box3().setFromObject(model);
        model.position.y -= box2.min.y;
        inner.add(model);

        const b = (n: string) => model.getObjectByName(n) ?? null;
        bones = {
          hips: b("Hips"),
          spine: b("Spine2") ?? b("Spine"),
          head: b("Head"),
          legL: b("LeftUpLeg"),
          legR: b("RightUpLeg"),
          shinL: b("LeftLeg"),
          shinR: b("RightLeg"),
          armL: b("LeftArm"),
          armR: b("RightArm"),
          foreL: b("LeftForeArm"),
          foreR: b("RightForeArm"),
        };
        for (const bone of Object.values(bones)) {
          if (bone) base.set(bone, bone.quaternion.clone());
        }
        hipsBaseY = bones.hips?.position.y ?? 0;
        bones.head?.add(headAttach);
        const hand = b("RightHand");
        if (hand) hand.add(handR);
      },
      undefined,
      () => {
        /* GLB မရရင် ဗလာ — kit fallback ကို createPlayerBody က ကိုင်တယ် */
      },
    );
  });

  /// bone ကို bind-pose ပေါ် axis-angle ထပ်လှည့်
  const rot = (
    bone: THREE.Object3D | null,
    x: number,
    y = 0,
    z = 0,
  ) => {
    if (!bone) return;
    const q = base.get(bone);
    if (!q) return;
    bone.quaternion
      .copy(q)
      .multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)),
      );
  };

  function update(dt: number, s: HumanState) {
    if (!bones) return;
    const moving = s.speed > 0.15;
    const run = s.speed > 5;
    if (moving) {
      // ခြေလှမ်း cycle — မြန်နှုန်းအလိုက် လှမ်းနှုန်း/လှမ်းကျယ် တက်
      const rate = run ? 11 : 7;
      const amp = run ? 0.85 : 0.55;
      phase += dt * rate * (s.backward ? -1 : 1);
      const sw = Math.sin(phase);
      const sw2 = Math.sin(phase + Math.PI);
      rot(bones.legL, sw * amp);
      rot(bones.legR, sw2 * amp);
      // ဒူးက ပေါင်နောက်ပြန်ချိန်မှာပဲ ကွေး (မြေအောက် မစူးအောင်)
      rot(bones.shinL, Math.max(0, -sw) * amp * 1.2);
      rot(bones.shinR, Math.max(0, -sw2) * amp * 1.2);
      rot(bones.armL, sw2 * amp * 0.7);
      rot(bones.armR, sw * amp * 0.7);
      rot(bones.foreL, -0.25);
      rot(bones.foreR, -0.25);
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
    } else if (s.emote === "dance") {
      phase += dt * 8;
      rot(bones.armL, 0, 0, 1.6 + Math.sin(phase) * 0.6);
      rot(bones.armR, 0, 0, -1.6 - Math.sin(phase + 1) * 0.6);
      rot(bones.spine, 0, Math.sin(phase * 0.5) * 0.25, 0);
      if (bones.hips) {
        bones.hips.position.y = hipsBaseY + Math.abs(Math.sin(phase)) * 0.05;
      }
    } else if (s.emote === "sit") {
      rot(bones.legL, -1.45);
      rot(bones.legR, -1.45);
      rot(bones.shinL, 1.4);
      rot(bones.shinR, 1.4);
      rot(bones.armL, -0.4);
      rot(bones.armR, -0.4);
      if (bones.hips) bones.hips.position.y = hipsBaseY - 0.35;
    } else {
      // idle — အသက်ရှူသလို နည်းနည်း လှုပ်
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

  function dispose() {
    disposed = true;
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

/// Kit rig နဲ့ စတင်ပြီး RPM url ရောက်ရင် ကိုယ်ထည် **နေရာတွင် လဲ** လို့ရတဲ့
/// player body။ Avatar object identity မပြောင်းလို့ scene ရဲ့ closure တွေ
/// (position/lerp/nametag) အကုန် ဒီအတိုင်း ဆက်အလုပ်လုပ်တယ်။
export function createPlayerBody(variant: string): Avatar {
  const group = new THREE.Group();
  let impl: Avatar = createRiggedHuman(variant);
  group.add(impl.group);
  // kit ရဲ့ setMorphs ကို ဆက်ဖောက်ပေး (RPM မှာ မလို — proportion အစစ်ပါပြီ)
  group.userData.setMorphs = (m: Record<string, number>) => {
    (impl.group.userData.setMorphs as
      | ((mm: Record<string, number>) => void)
      | undefined)?.(m);
  };
  group.userData.setRpm = (url: string) => {
    if (typeof url !== "string" || !url) return;
    const old = impl;
    impl = createRpmHuman(url);
    group.add(impl.group);
    group.remove(old.group);
    old.dispose();
    group.userData.noScanFace = true;
    // ရှိပြီးသား scan-face plate ဖယ် (kit ခေါင်းက ဆွဲထားခဲ့ရင်)
    const plate = group.getObjectByName("scanface-plate");
    plate?.parent?.remove(plate);
  };

  return {
    group,
    get attach() {
      return impl.attach;
    },
    attachments: [],
    materials: impl.materials,
    update: (dt, s) => impl.update(dt, s),
    dispose: () => impl.dispose(),
  };
}
