import * as THREE from "three";

import type { BuildingDef } from "../maps/types";
import type { PropFactory } from "./props";

/// အခန်းထဲ ဝင်လို့ရအောင် — **inline interior** (spec 8.5 ရဲ့ နည်း (က))။
///
/// ★ အဆောက်အအုံကို အခဲကြီးအဖြစ် မဆောက်ဘဲ **အခွံ** အဖြစ် ဆောက်တယ်:
///   နံရံ ၄ ချပ် + ကြမ်းပြင် + အမိုး။ တံခါးဘက်က နံရံကို ၂ ပိုင်းခွဲပြီး
///   အလယ်မှာ အပေါက်ချန်တယ်။ Player က တိုက်ရိုက် လျှောက်ဝင်တယ် — loading
///   မရှိ၊ teleport မရှိ၊ Roblox ရဲ့ ခံစားချက်။
/// ★ **Collider က နံရံတစ်ချပ်ချင်း** ထည့်ရမယ်၊ အဆောက်အအုံတစ်ခုလုံးအတွက်
///   box တစ်ခု မထည့်ရ — မဟုတ်ရင် တံခါးပေါက်ကနေ ဝင်လို့မရဘဲ အပြင်မှာပဲ
///   ကပ်နေမယ်။
/// ★ **၂၅ unit အတွင်း ရောက်မှ ပြတယ်** — အခန်း ၁၉ ခုစလုံးရဲ့ ပရိဘောဂတွေ
///   အမြဲဆွဲနေရင် ဖုန်းအဟောင်းမှာ မတင်ဘူး။

export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };

export type Interior = {
  /// အခန်းထဲက အရာအားလုံး — ဝေးရင် ဖျောက်ဖို့
  group: THREE.Group;
  lights: THREE.PointLight[];
  center: { x: number; z: number };
  dispose(): void;
};

const WALL_T = 0.3;
/// ဒီအကွာအဝေးအတွင်း ရောက်မှ အခန်းထဲက အရာတွေ ပေါ်တယ်
export const INTERIOR_VISIBLE_WITHIN = 25;

export function buildInterior(
  scene: THREE.Scene,
  b: BuildingDef,
  colliders: Collider[],
  props: PropFactory,
): Interior | null {
  const it = b.interior;
  if (!it) return null;

  const group = new THREE.Group();
  group.position.set(b.x, 0, b.z);
  const own: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    own.push(x);
    return x;
  };

  const hw = it.w / 2;
  const hd = it.d / 2;

  // ── ကြမ်းပြင် ───────────────────────────────────────────────────────────
  const floorGeo = track(new THREE.BoxGeometry(it.w, 0.2, it.d));
  const floorMat = track(
    new THREE.MeshStandardMaterial({ color: it.floorColor, roughness: 0.9 }),
  );
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.1;
  floor.receiveShadow = true;
  group.add(floor);

  // ── နံရံများ ────────────────────────────────────────────────────────────
  const wallMat = track(
    new THREE.MeshStandardMaterial({ color: it.wallColor, roughness: 0.85 }),
  );

  /// နံရံတစ်ချပ် — `gap` ရှိရင် အလယ်မှာ တံခါးပေါက် ချန်ပြီး ၂ ပိုင်းခွဲတယ်။
  const wall = (
    side: "N" | "S" | "E" | "W",
    gap: number,
  ) => {
    const along = side === "N" || side === "S" ? it.w : it.d;
    const segLen = gap > 0 ? (along - gap) / 2 : along;
    if (segLen <= 0.01) return; // တံခါးက နံရံထက် ကျယ်နေရင် နံရံ မဆောက်ဘူး

    const pieces: { len: number; offset: number }[] =
      gap > 0
        ? [
            { len: segLen, offset: -(gap / 2 + segLen / 2) },
            { len: segLen, offset: gap / 2 + segLen / 2 },
          ]
        : [{ len: along, offset: 0 }];

    for (const p of pieces) {
      const horizontal = side === "N" || side === "S";
      const w = horizontal ? p.len : WALL_T;
      const d = horizontal ? WALL_T : p.len;
      const geo = track(new THREE.BoxGeometry(w, it.h, d));
      const mesh = new THREE.Mesh(geo, wallMat);
      const cx = horizontal ? p.offset : side === "E" ? hw : -hw;
      const cz = horizontal ? (side === "S" ? hd : -hd) : p.offset;
      mesh.position.set(cx, it.h / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // ★ collider က နံရံအပိုင်းတစ်ခုချင်း — အပေါက်နေရာမှာ မထည့်ဘူး
      colliders.push({
        minX: b.x + cx - w / 2,
        maxX: b.x + cx + w / 2,
        minZ: b.z + cz - d / 2,
        maxZ: b.z + cz + d / 2,
      });
    }
  };

  for (const side of ["N", "S", "E", "W"] as const) {
    wall(side, it.door.side === side ? it.door.width : 0);
  }

  // ── အမိုး ───────────────────────────────────────────────────────────────
  const roofGeo = track(new THREE.BoxGeometry(it.w + WALL_T, 0.25, it.d + WALL_T));
  const roofMat = track(
    new THREE.MeshStandardMaterial({ color: b.roofColor ?? b.color, roughness: 0.8 }),
  );
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = it.h;
  roof.castShadow = true;
  group.add(roof);

  // ── ပရိဘောဂ ────────────────────────────────────────────────────────────
  for (const p of it.props) {
    const obj = props.make(p);
    if (obj) group.add(obj);
  }

  // ── အလင်း ──────────────────────────────────────────────────────────────
  // ★ PointLight က shadow မထုတ်ဘူး — အခန်း ၁၉ ခု × shadow map က
  // ဖုန်းအဟောင်းမှာ လုံးဝ မတင်ဘူး။
  const lights: THREE.PointLight[] = [];
  for (const l of it.lights) {
    const light = new THREE.PointLight(l.color, l.intensity, Math.max(it.w, it.d) * 1.6, 2);
    light.position.set(l.x, l.y, l.z);
    group.add(light);
    lights.push(light);
  }

  scene.add(group);

  return {
    group,
    lights,
    center: { x: b.x, z: b.z },
    dispose() {
      scene.remove(group);
      for (const d of own) d.dispose();
    },
  };
}
