import * as THREE from "three";

import type { PropDef, PropKind } from "../maps/types";

/// အခန်းထဲက ပရိဘောဂ — box နဲ့ cylinder အရိုးရှင်းဆုံးပုံစံ (Roblox style)။
///
/// ★ **Geometry နဲ့ material ကို မျှသုံးတယ်** — အခန်း ၁၉ ခုမှာ ကုလားထိုင်
///   ၅၀ ခုရှိရင် BoxGeometry ၅၀ ခု သီးသန့်ဆောက်တာက memory ရော draw call
///   ရော အလကားကုန်တယ်။ kind တစ်ခုလျှင် geometry တစ်ခုပဲ ဆောက်ပြီး
///   ပြန်သုံးတယ်။
/// ★ ခေါ်တဲ့ဘက်က `dispose()` ကို မဖြစ်မနေ ခေါ်ရမယ် — cache က module
///   အဆင့်မှာ မထားဘူး၊ scene တစ်ခုချင်းစီအတွက် ဆောက်တယ် (map ပြောင်းရင်
///   အကုန် သန့်ရှင်းသွားဖို့)။

export type PropFactory = {
  make(def: PropDef): THREE.Object3D | null;
  dispose(): void;
};

type Piece = { geo: THREE.BufferGeometry; color: number; y: number; ry?: number };

/// ပရိဘောဂတစ်ခုက box အနည်းငယ်နဲ့ ပြီးတယ် — အသေးစိတ်လုပ်ရင် ဖုန်းမှာ
/// မတင်ဘူး၊ ပြီးတော့ ဒီပုံစံက Roblox ရဲ့ ခံစားချက်နဲ့ ကိုက်တယ်။
const RECIPES: Record<PropKind, (c: number) => { w: number; h: number; d: number; y: number; color: number }[]> = {
  table: (c) => [
    { w: 1.4, h: 0.1, d: 1.0, y: 0.75, color: c },
    { w: 0.12, h: 0.75, d: 0.12, y: 0.37, color: c },
  ],
  chair: (c) => [
    { w: 0.5, h: 0.09, d: 0.5, y: 0.45, color: c },
    { w: 0.5, h: 0.6, d: 0.09, y: 0.75, color: c },
    { w: 0.09, h: 0.45, d: 0.09, y: 0.22, color: c },
  ],
  shelf: (c) => [
    { w: 1.6, h: 0.08, d: 0.5, y: 0.5, color: c },
    { w: 1.6, h: 0.08, d: 0.5, y: 1.1, color: c },
    { w: 1.6, h: 0.08, d: 0.5, y: 1.7, color: c },
    { w: 0.09, h: 1.8, d: 0.5, y: 0.9, color: c },
  ],
  counter: (c) => [
    { w: 3.0, h: 1.0, d: 0.7, y: 0.5, color: c },
    { w: 3.2, h: 0.08, d: 0.85, y: 1.04, color: 0xe8e2d8 },
  ],
  bed: (c) => [
    { w: 1.4, h: 0.35, d: 2.0, y: 0.2, color: 0x6b4a35 },
    { w: 1.35, h: 0.22, d: 1.9, y: 0.48, color: c },
    { w: 1.2, h: 0.16, d: 0.45, y: 0.66, color: 0xf0f0f0 },
  ],
  plant: (c) => [
    { w: 0.5, h: 0.4, d: 0.5, y: 0.2, color: 0x9c6b3f },
    { w: 0.75, h: 1.1, d: 0.75, y: 0.95, color: c },
  ],
  crate: (c) => [{ w: 0.9, h: 0.9, d: 0.9, y: 0.45, color: c }],
  screen: (c) => [
    { w: 2.4, h: 1.4, d: 0.12, y: 0, color: c },
    { w: 2.6, h: 1.6, d: 0.06, y: 0, color: 0x1a1f28 },
  ],
  lamp: (c) => [
    { w: 0.16, h: 1.3, d: 0.16, y: 0.65, color: 0x3a3f48 },
    { w: 0.5, h: 0.4, d: 0.5, y: 1.5, color: c },
  ],
  rug: (c) => [{ w: 2.6, h: 0.03, d: 1.8, y: 0.02, color: c }],
};

const DEFAULT_COLOR: Record<PropKind, number> = {
  table: 0x8b5a2b,
  chair: 0x8b5a2b,
  shelf: 0x8b5a2b,
  counter: 0x6b4a35,
  bed: 0x4a6b8b,
  plant: 0x3f8f4a,
  crate: 0x9c7b4f,
  screen: 0x2a3442,
  lamp: 0xffe0a0,
  rug: 0x8b3a3a,
};

/// မီးလင်းရမယ့် ပစ္စည်း — screen နဲ့ lamp က ညမှာ တောက်ရမယ်
const EMISSIVE: Partial<Record<PropKind, number>> = { screen: 0.9, lamp: 0.85 };

export function createPropFactory(): PropFactory {
  const geoCache = new Map<string, THREE.BufferGeometry>();
  const matCache = new Map<string, THREE.Material>();

  const geo = (w: number, h: number, d: number) => {
    const key = `${w}|${h}|${d}`;
    let g = geoCache.get(key);
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d);
      geoCache.set(key, g);
    }
    return g;
  };

  const mat = (color: number, emissive: number) => {
    const key = `${color}|${emissive}`;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8,
        emissive: emissive > 0 ? color : 0x000000,
        emissiveIntensity: emissive,
      });
      matCache.set(key, m);
    }
    return m;
  };

  return {
    make(def) {
      const recipe = RECIPES[def.kind];
      if (!recipe) return null;
      const color = def.color ?? DEFAULT_COLOR[def.kind];
      const emissive = EMISSIVE[def.kind] ?? 0;
      const group = new THREE.Group();
      const pieces: Piece[] = recipe(color).map((p) => ({
        geo: geo(p.w, p.h, p.d),
        color: p.color,
        y: p.y,
      }));
      for (const p of pieces) {
        const mesh = new THREE.Mesh(p.geo, mat(p.color, emissive));
        mesh.position.y = p.y;
        mesh.castShadow = def.kind !== "rug";
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      const s = def.scale ?? 1;
      group.scale.setScalar(s);
      group.position.set(def.x, def.y, def.z);
      group.rotation.y = def.ry ?? 0;
      return group;
    },
    dispose() {
      for (const g of geoCache.values()) g.dispose();
      for (const m of matCache.values()) m.dispose();
      geoCache.clear();
      matCache.clear();
    },
  };
}
