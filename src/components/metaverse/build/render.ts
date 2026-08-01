import * as THREE from "three";

import { BUILD_TYPES, type BuildObject, type BuildType } from "@/lib/metaverse/build";

/// ဆောက်ထားတဲ့ ပစ္စည်းများကို ဆွဲခြင်း (Phase 18.6)。
///
/// ★ **InstancedMesh မဖြစ်မနေ** — နံရံ ၅၀ ချပ်ကို Mesh ၅၀ ခုနဲ့ ဆွဲရင်
///   draw call ၅၀ ဖြစ်တယ်။ ကွက် ၄၉ ခု × ၂၀၀ object = ၉,၈၀၀ draw call
///   ဖြစ်ပြီး ဖုန်းက လုံးဝ မတင်ဘူး။ Type တစ်ခုချင်း အုပ်စုဖွဲ့ရင်
///   draw call က **၁၁ ခု** (type အရေအတွက်) ပဲ ဖြစ်တယ်။
/// ★ InstancedMesh က အရေအတွက် သတ်မှတ်ပြီးမှ ဆောက်ရတယ် — build ပြောင်းတိုင်း
///   အသစ် ဆောက်ရမယ်။ ဒါကြောင့် build ပြောင်းတာက **မကြာခဏ မဖြစ်ရ**
///   (ဆောက်နေစဉ် preview က သီးခြား mesh နဲ့၊ သိမ်းမှ instance ပြန်ဆောက်တယ်)。

/// Type တစ်ခုချင်းရဲ့ ပုံသဏ္ဌာန်။ အားလုံးက unit box ကို အခြေခံပြီး
/// matrix နဲ့ ချုံ့/ဆန့်တယ် — geometry အမျိုးအစား နည်းလေ instancing
/// လုပ်ရ လွယ်လေ။
type Shape = {
  geo: () => THREE.BufferGeometry;
  /// အခြေခံ အရွယ် (x, y, z) — object ရဲ့ scale က ဒီအပေါ် မြှောက်တယ်
  size: [number, number, number];
  color: number;
  /// မြေပြင်ကနေ အလယ်ဗဟိုအထိ အမြင့် (ဆွဲတဲ့အခါ y ကို ပြင်ဖို့)
  lift: number;
};

const box = () => new THREE.BoxGeometry(1, 1, 1);

const SHAPES: Record<BuildType, Shape> = {
  wall: { geo: box, size: [2, 3, 0.2], color: 0xd8d3c8, lift: 1.5 },
  floor: { geo: box, size: [2, 0.15, 2], color: 0xb6a48a, lift: 0.07 },
  roof: { geo: box, size: [2.4, 0.2, 2.4], color: 0x8c4a3a, lift: 0.1 },
  door: { geo: box, size: [0.9, 2.1, 0.15], color: 0x6b4423, lift: 1.05 },
  window: { geo: box, size: [1, 1, 0.12], color: 0x8fd0e8, lift: 1.6 },
  fence: { geo: box, size: [2, 1, 0.1], color: 0x9a7b4f, lift: 0.5 },
  tree: {
    geo: () => new THREE.ConeGeometry(0.6, 2.4, 7),
    size: [1, 1, 1],
    color: 0x4a7a3a,
    lift: 1.2,
  },
  lamp: {
    geo: () => new THREE.CylinderGeometry(0.08, 0.1, 3, 6),
    size: [1, 1, 1],
    color: 0x4a4a52,
    lift: 1.5,
  },
  chair: { geo: box, size: [0.5, 0.9, 0.5], color: 0x7a5b3a, lift: 0.45 },
  table: { geo: box, size: [1.2, 0.75, 0.8], color: 0x8b6b45, lift: 0.38 },
  sign: { geo: box, size: [1.4, 0.8, 0.08], color: 0xf2e7c8, lift: 1.4 },
};

export type BuildRender = {
  /// ပြမယ့် object စာရင်းကို အစားထိုးတယ် (ကွက်အားလုံးပေါင်း)
  set(objects: BuildObject[]): void;
  /// ဆိုင်းဘုတ်စာသားများ — DOM overlay က ဒါကို သုံးတယ်
  signs(): { x: number; y: number; z: number; text: string }[];
  count(): number;
  dispose(): void;
};

const dummy = new THREE.Object3D();
const colour = new THREE.Color();

export function createBuildRender(scene: THREE.Scene): BuildRender {
  const group = new THREE.Group();
  group.name = "builds";
  scene.add(group);

  /// type -> mesh (ရှိပြီးသားကို ပြန်သုံးလို့မရဘူး၊ instance count က
  /// ပုံသေဖြစ်လို့ — ဒါပေမယ့် geometry/material ကို ပြန်သုံးလို့ရတယ်)
  const geos = new Map<BuildType, THREE.BufferGeometry>();
  const mats = new Map<BuildType, THREE.Material>();
  const meshes = new Map<BuildType, THREE.InstancedMesh>();
  let signList: { x: number; y: number; z: number; text: string }[] = [];
  let total = 0;

  for (const t of BUILD_TYPES) {
    const shape = SHAPES[t];
    geos.set(t, shape.geo());
    mats.set(
      t,
      new THREE.MeshLambertMaterial({
        // ★ Lambert — PBR (MeshStandardMaterial) က မြေပြင်တစ်ခုလုံး ဖုံးတဲ့
        // အရာတွေမှာ frame ကို ဖြုတ်ပစ်တယ် (Phase 9–13 မှာ ကြုံခဲ့တယ်)。
        color: 0xffffff,
        vertexColors: false,
      }),
    );
  }

  const clearMeshes = () => {
    for (const [t, mesh] of meshes) {
      group.remove(mesh);
      mesh.dispose();
      meshes.delete(t);
    }
  };

  return {
    set(objects) {
      clearMeshes();
      signList = [];
      total = objects.length;

      // Type အလိုက် အုပ်စုဖွဲ့
      const byType = new Map<BuildType, BuildObject[]>();
      for (const o of objects) {
        const t = o.t as BuildType;
        if (!SHAPES[t]) continue;
        const list = byType.get(t);
        if (list) list.push(o);
        else byType.set(t, [o]);
        if (t === "sign" && o.txt) {
          signList.push({ x: o.x, y: o.y + SHAPES.sign.lift + 0.6, z: o.z, text: o.txt });
        }
      }

      for (const [t, list] of byType) {
        const shape = SHAPES[t];
        const geo = geos.get(t);
        const mat = mats.get(t);
        if (!geo || !mat) continue;

        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        for (let i = 0; i < list.length; i++) {
          const o = list[i];
          if (!o) continue;
          dummy.position.set(
            o.x,
            o.y + shape.lift * (o.sy ?? 1),
            o.z,
          );
          dummy.rotation.set(0, (o.ry * Math.PI) / 180, 0);
          dummy.scale.set(
            shape.size[0] * (o.sx ?? 1),
            shape.size[1] * (o.sy ?? 1),
            shape.size[2] * (o.sz ?? 1),
          );
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          // ★ အရောင်ကို instance တစ်ခုချင်း ပေးတယ် — မဟုတ်ရင် type
          // တစ်ခုလုံး အရောင်တူဖြစ်ပြီး "ကိုယ်ပိုင်" ဆိုတာ ပျောက်သွားမယ်။
          mesh.setColorAt(i, colour.setHex(o.c ?? shape.color));
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        group.add(mesh);
        meshes.set(t, mesh);
      }
    },

    signs: () => signList,
    count: () => total,

    dispose() {
      clearMeshes();
      for (const g of geos.values()) g.dispose();
      for (const m of mats.values()) m.dispose();
      geos.clear();
      mats.clear();
      scene.remove(group);
    },
  };
}

/// Preview (ghost) — ချမယ့်နေရာကို ကြိုပြတဲ့ mesh တစ်ခု။
export function createGhost(scene: THREE.Scene) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x44bba4,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  scene.add(mesh);

  return {
    show(t: BuildType, x: number, y: number, z: number, ry: number, valid: boolean) {
      const shape = SHAPES[t];
      if (!shape) return;
      mesh.visible = true;
      mesh.position.set(x, y + shape.lift, z);
      mesh.rotation.set(0, (ry * Math.PI) / 180, 0);
      mesh.scale.set(shape.size[0], shape.size[1], shape.size[2]);
      // ★ မချရတဲ့နေရာမှာ **အနီ** — မဟုတ်ရင် နှိပ်ပြီးမှ error ပြရမယ်၊
      // အဲဒါက စိတ်ပျက်စရာ ကောင်းတယ်။
      mat.color.setHex(valid ? 0x44bba4 : 0xe94f37);
    },
    hide() {
      mesh.visible = false;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}

export type Ghost = ReturnType<typeof createGhost>;
