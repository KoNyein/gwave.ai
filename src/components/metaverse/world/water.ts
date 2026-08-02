import * as THREE from "three";

import type { WaterDef } from "../maps/types";

/// ရေ — ကန်၊ မြစ်၊ ရေကူးကန်။
///
/// ★ လှိုင်းကို **vertex ကို ကိုယ်တိုင် ရွှေ့ပြီး** လုပ်တယ်၊ shader
///   မရေးဘူး — segment ၃၂×၃၂ က frame တစ်ခုမှာ vertex ၁၀၀၀ ကျော်ပဲ
///   ဖြစ်လို့ CPU မှာ လုံလောက်တယ်၊ ပြီးတော့ shader က ဖုန်းအဟောင်းအချို့မှာ
///   compile မရတဲ့ ပြဿနာ မရှိတော့ဘူး။
/// ★ `isInside`/`levelAt` က ဂိမ်းစည်းမျဉ်းအတွက် — ရေထဲမှာ လမ်းလျှောက်နှုန်း
///   လျော့တယ်၊ လှေက ကုန်းပေါ် မတက်ဘူး။ Mesh ကို မကြည့်ဘဲ ကိန်းဂဏန်းနဲ့
///   တွက်တယ် (raycast က ဈေးကြီးလွန်းတယ်)။

export type Water = {
  meshes: THREE.Mesh[];
  update(t: number): void;
  /// ဒီနေရာမှာ ရေရှိလား
  isInside(x: number, z: number): boolean;
  /// ရေမျက်နှာ အမြင့် (ရေမရှိရင် -Infinity)
  levelAt(x: number, z: number): number;
  /// ရေရဲ့ အနက် — 0 = ရေမရှိ
  depthAt(x: number, z: number, groundY?: number): number;
  dispose(): void;
};

/// မြစ်ကို လမ်းကြောင်းအပိုင်းတွေအဖြစ် ခွဲတယ် — အပိုင်းတစ်ခုက စတုဂံတစ်ခု
type Segment = { x1: number; z1: number; x2: number; z2: number; half: number };

const RIVER_HALF_WIDTH = 5;

function segmentsOf(def: WaterDef): Segment[] {
  const pts = def.points ?? [];
  const out: Segment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    out.push({ x1: a[0], z1: a[1], x2: b[0], z2: b[1], half: RIVER_HALF_WIDTH });
  }
  return out;
}

/// အမှတ်တစ်ခုက အပိုင်းတစ်ခုနဲ့ ဘယ်လောက်ဝေးလဲ (point-to-segment)
function distToSegment(px: number, pz: number, s: Segment): number {
  const dx = s.x2 - s.x1;
  const dz = s.z2 - s.z1;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return Math.hypot(px - s.x1, pz - s.z1);
  let t = ((px - s.x1) * dx + (pz - s.z1) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.x1 + t * dx), pz - (s.z1 + t * dz));
}

/// ★ ရေမှာ **PBR (MeshStandardMaterial) မသုံးရ**။ PBR က three.js ရဲ့
/// အဈေးအကြီးဆုံး shader ဖြစ်ပြီး ရေက ဖောက်ထွင်းမြင်ရလို့ pixel တစ်ခုကို
/// ၂ ခါ ဆွဲရတယ် — မြစ်က map တစ်ခုလုံး ဖြတ်နေတာမို့ မျက်နှာပြင်အများစုကို
/// ဖုံးတယ်။ တိုင်းတာကြည့်တော့ မြစ်ပါတဲ့ map ၂ ခု (မြို့, လယ်) က 0fps ဖြစ်ပြီး
/// မြစ်မပါတဲ့ ၂ ခု (နှင်း, ကောင်းကင်) က 20fps ရှိတယ်။ Lambert က
/// အလင်းကို လက်ခံပေမယ့် PBR တွက်ချက်မှု မလိုဘူး။
function makeWaterMaterial(def: WaterDef) {
  return new THREE.MeshLambertMaterial({
    color: def.color,
    transparent: true,
    opacity: def.opacity,
    // ★ depthWrite ပိတ်တာက ရေအောက်က အရာတွေ ပျောက်မသွားဖို့
    depthWrite: false,
  });
}

export function createWater(defs: WaterDef[], scene: THREE.Scene): Water {
  const meshes: THREE.Mesh[] = [];
  const geos: THREE.PlaneGeometry[] = [];
  const mats: THREE.Material[] = [];
  const bases: Float32Array[] = [];
  const bodies: { def: WaterDef; segs: Segment[] }[] = [];

  for (const def of defs) {
    const isRiver = def.kind === "river";
    const segs = isRiver ? segmentsOf(def) : [];
    bodies.push({ def, segs });

    // ── Mesh ──────────────────────────────────────────────────────────────
    if (isRiver) {
      // မြစ် — အပိုင်းတစ်ခုချင်း စတုဂံ plane
      for (const s of segs) {
        const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
        // segment ကို အကွက်များများ ခွဲစရာမလိုဘူး — လှိုင်းက ၁၂ စင်တီမီတာပဲ
        const geo = new THREE.PlaneGeometry(s.half * 2, len, 4, 8);
        const mat = makeWaterMaterial(def);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -Math.atan2(s.x2 - s.x1, s.z2 - s.z1);
        mesh.position.set((s.x1 + s.x2) / 2, def.level, (s.z1 + s.z2) / 2);
        scene.add(mesh);
        meshes.push(mesh);
        geos.push(geo);
        mats.push(mat);
        bases.push(Float32Array.from(geo.attributes.position!.array));
      }
      continue;
    }

    const r = def.radius ?? 8;
    const geo = new THREE.PlaneGeometry(r * 2, r * 2, 16, 16);
    const mat = makeWaterMaterial(def);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(def.x ?? 0, def.level, def.z ?? 0);
    scene.add(mesh);
    meshes.push(mesh);
    geos.push(geo);
    mats.push(mat);
    bases.push(Float32Array.from(geo.attributes.position!.array));
  }

  return {
    meshes,
    update(t) {
      for (let m = 0; m < geos.length; m++) {
        const geo = geos[m];
        const base = bases[m];
        if (!geo || !base) continue;
        const attr = geo.attributes.position;
        if (!attr) continue;
        // ★ plane က ပြားနေတုန်းက တွက်တာမို့ z က အမြင့် (rotate ပြီးမှ y)
        for (let i = 0; i < attr.count; i++) {
          const bx = base[i * 3] ?? 0;
          const by = base[i * 3 + 1] ?? 0;
          attr.setZ(i, Math.sin(bx * 0.3 + t) * 0.12 + Math.sin(by * 0.5 + t * 1.3) * 0.08);
        }
        attr.needsUpdate = true;
        // ★ `computeVertexNormals()` ကို frame တိုင်း **မခေါ်ရ** — vertex
        // ၁၀၀၀ ကျော် × mesh ၅ ခုကို frame တိုင်း ပြန်တွက်ရင် CPU က
        // ကုန်သွားတယ် (တိုင်းတာပြီးသား: 20fps → 0fps)။ လှိုင်းက
        // ၁၂ စင်တီမီတာပဲ မြင့်တာမို့ normal အဟောင်းနဲ့ ကြည့်လို့ကောင်းတယ်။
      }
    },

    isInside(x, z) {
      for (const b of bodies) {
        if (b.def.kind === "river") {
          for (const s of b.segs) if (distToSegment(x, z, s) < s.half) return true;
        } else {
          const r = b.def.radius ?? 8;
          if (Math.hypot(x - (b.def.x ?? 0), z - (b.def.z ?? 0)) < r) return true;
        }
      }
      return false;
    },

    levelAt(x, z) {
      let best = -Infinity;
      for (const b of bodies) {
        const inside =
          b.def.kind === "river"
            ? b.segs.some((s) => distToSegment(x, z, s) < s.half)
            : Math.hypot(x - (b.def.x ?? 0), z - (b.def.z ?? 0)) < (b.def.radius ?? 8);
        if (inside) best = Math.max(best, b.def.level);
      }
      return best;
    },

    depthAt(x, z, groundY = 0) {
      const lvl = this.levelAt(x, z);
      if (!Number.isFinite(lvl)) return 0;
      // ★ အလယ်နားက ပိုနက်တယ် — အနားမှာ ရေတိမ်ပြီး လမ်းလျှောက်ဝင်လို့ရ၊
      // အလယ်ရောက်မှ ရေကူးရတာက သဘာဝကျတယ်။
      let deepest = 0;
      for (const b of bodies) {
        const r = b.def.radius ?? RIVER_HALF_WIDTH;
        const d =
          b.def.kind === "river"
            ? Math.min(...b.segs.map((s) => distToSegment(x, z, s)), Infinity)
            : Math.hypot(x - (b.def.x ?? 0), z - (b.def.z ?? 0));
        if (d < r) deepest = Math.max(deepest, (1 - d / r) * 2.2);
      }
      return Math.max(0, deepest + (lvl - groundY));
    },

    dispose() {
      for (const m of meshes) scene.remove(m);
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
