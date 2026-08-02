// ★ `.ts` extension က မဖြစ်မနေ — metadata generator က ဒီ file ကို
// `node --experimental-strip-types` နဲ့ တိုက်ရိုက် import လုပ်တယ်၊
// node က extension မပါရင် ရှာမတွေ့ဘူး (bundler က ရတယ်)。
import { GRID_COLS, LIMITS } from "./build.ts";

import type { MapDef, WaterDef } from "@/components/metaverse/maps/types";

/// Phase W6 — မြေကွက်တစ်ကွက်ချင်းရဲ့ ဂုဏ်သတ္တိတွေ။
///
/// ★ **ကျပန်း မဟုတ်ရ** — trait တွေက လောကထဲမှာ တကယ်ရှိတဲ့အရာကနေ
///   တွက်ရမယ်။ "ရေလမ်းရှိတယ်" လို့ ရေးထားပြီး ဝင်ကြည့်တဲ့အခါ ရေမရှိရင်
///   ဒါက user ကို လိမ်တာပဲ — ပြီးတော့ တန်ဖိုးရှိတဲ့ ပစ္စည်းတစ်ခုအတွက်
///   ဖြစ်တာမို့ ပိုဆိုးတယ်။
/// ★ ဒါကြောင့် spec ရဲ့ `roadAccess` ကို **မထည့်ဘူး** — Gwave ရဲ့ map
///   data ထဲမှာ လမ်းမ (road) ဆိုတာ လုံးဝ မရှိဘူး (`world.ts` က လမ်း
///   မဆောက်ဘူး)。 အစားထိုးအနေနဲ့ တကယ်ရှိတဲ့ **မီးတိုင်** နဲ့
///   **အဆောက်အအုံ** ကို သုံးတယ်။
/// ★ ဒီ file က client/script နှစ်ဖက်လုံးက သုံးတယ် — metadata generator
///   နဲ့ UI က တူညီတဲ့ အဖြေ ပြရမယ်။

export type Rarity = "Legendary" | "Rare" | "Uncommon" | "Common";

export type PlotTraits = {
  plotId: number;
  gridX: number;
  gridZ: number;
  /// ကွက်ရဲ့ အလယ် (world coordinate)
  centerX: number;
  centerZ: number;
  size: number;
  /// လောကရဲ့ အလယ်ကနေ အကွာအဝေး (မီတာ)
  distance: number;
  zone: string;
  rarity: Rarity;
  waterAccess: boolean;
  /// အနီးဆုံး ရေအထိ (မီတာ) — မရှိရင် null
  waterDistance: number | null;
  /// ညမှာ မီးလင်းလား (မီးတိုင် အနီးမှာလား)
  lit: boolean;
  /// ကွက်ပေါ်မှာ ဒါမှမဟုတ် ကပ်လျက် ရှိတဲ့ အဆောက်အအုံ အရေအတွက်
  buildings: number;
  /// သစ်ပင် အရေအတွက်
  trees: number;
  /// လောကရဲ့ အနားသတ်အပြင်ဘက် ကျနေလား — ဒါဆို ဝင်လို့ မရဘူး
  outOfBounds: boolean;
};

/// ကွက်တစ်ကွက်ရဲ့ world coordinate နယ်နိမိတ်။
/// ★ `plotIdAt()` (build/plots.ts) ရဲ့ ပြောင်းပြန် — နှစ်ခု ကွဲသွားရင်
///   UI မှာ ပြတဲ့ ကွက်နဲ့ metadata ထဲက ကွက် မတူတော့ဘူး။
export function plotBounds(gridX: number, gridZ: number) {
  const s = LIMITS.plotSize;
  const minX = (gridX - GRID_COLS / 2) * s;
  const minZ = (gridZ - GRID_COLS / 2) * s;
  return { minX, minZ, maxX: minX + s, maxZ: minZ + s, centerX: minX + s / 2, centerZ: minZ + s / 2 };
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  // ★ အမှတ် ၂ ခု တူနေရင် (len2 = 0) ခွဲလို့ မရဘူး — အဲဒါက map data
  //   ထဲမှာ ဖြစ်နိုင်တယ် (point ၂ ခု ထပ်ရေးမိတာ)。
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/// ရေအမျိုးအစား တစ်ခုကနေ အကွာအဝေး — ကမ်းစပ်အထိ (အလယ်အထိ မဟုတ်)。
function waterDistance(px: number, pz: number, w: WaterDef): number | null {
  if (w.points && w.points.length >= 2) {
    let best = Infinity;
    for (let i = 0; i + 1 < w.points.length; i++) {
      const a = w.points[i];
      const b = w.points[i + 1];
      if (!a || !b) continue;
      best = Math.min(best, distToSegment(px, pz, a[0], a[1], b[0], b[1]));
    }
    // မြစ်ရဲ့ အကျယ်ကို polyline က မပြောဘူး — ~၈ မီတာလို့ ယူတယ်
    return Number.isFinite(best) ? Math.max(0, best - 8) : null;
  }
  if (typeof w.x === "number" && typeof w.z === "number") {
    const r = w.radius ?? 0;
    return Math.max(0, Math.hypot(px - w.x, pz - w.z) - r);
  }
  return null;
}

/// ကွက်တစ်ကွက်ရဲ့ ဂုဏ်သတ္တိတွေကို map data ကနေ တွက်တယ်။
export function traitsFor(gridX: number, gridZ: number, map: MapDef): PlotTraits {
  const b = plotBounds(gridX, gridZ);
  const half = LIMITS.plotSize / 2;
  const distance = Math.hypot(b.centerX, b.centerZ);

  // ── ရေ ──────────────────────────────────────────────────────────────
  let nearestWater: number | null = null;
  for (const w of map.water ?? []) {
    const d = waterDistance(b.centerX, b.centerZ, w);
    if (d === null) continue;
    nearestWater = nearestWater === null ? d : Math.min(nearestWater, d);
  }
  // ကွက်ရဲ့ အစွန်းကနေ တစ်ကွက်စာအတွင်း ဆိုရင် "ရေလမ်းရှိတယ်"
  const waterAccess = nearestWater !== null && nearestWater <= half + LIMITS.plotSize;

  // ── မီးတိုင် ────────────────────────────────────────────────────────
  const lit = (map.lamps ?? []).some(
    (l) => Math.abs(l.x - b.centerX) <= LIMITS.plotSize && Math.abs(l.z - b.centerZ) <= LIMITS.plotSize,
  );

  // ── အဆောက်အအုံ (footprint ထပ်နေတာ) ─────────────────────────────────
  const buildings = (map.buildings ?? []).filter((bd) => {
    const hw = bd.w / 2;
    const hd = bd.d / 2;
    return (
      bd.x + hw >= b.minX && bd.x - hw <= b.maxX && bd.z + hd >= b.minZ && bd.z - hd <= b.maxZ
    );
  }).length;

  const trees = (map.trees ?? []).filter(
    (t) => t.x >= b.minX && t.x < b.maxX && t.z >= b.minZ && t.z < b.maxZ,
  ).length;

  const outOfBounds = distance - half > map.worldRadius;

  // ── ဇုန် ────────────────────────────────────────────────────────────
  // ★ လောကရဲ့ အရွယ်နဲ့ အချိုးကျ တွက်တယ် — မီတာ hardcode လုပ်ရင်
  //   map အသစ်တစ်ခု (worldRadius မတူတာ) ထည့်တဲ့အခါ အကုန် မှားမယ်။
  const r = distance / Math.max(1, map.worldRadius);
  const zone = outOfBounds
    ? "အပြင်ဘက်"
    : r < 0.2
      ? "မြို့လယ်"
      : r < 0.45
        ? "အတွင်းဝိုင်း"
        : r < 0.75
          ? "အပြင်ဝိုင်း"
          : "မြို့စွန်";

  // ── ရှားပါးမှု ───────────────────────────────────────────────────────
  // ★ အလယ်နဲ့ နီးလေ၊ ရေရှိလေ၊ အဆောက်အအုံရှိလေ ရှားလေ။ တွက်နည်းကို
  //   ဒီမှာ ရေးထားတာက **ရည်ရွယ်ချက်ရှိတယ်** — user တစ်ယောက်က
  //   "ဘာလို့ ငါ့ကွက်က Common လဲ" မေးရင် ဖြေလို့ရရမယ်။
  let score = 0;
  if (r < 0.2) score += 3;
  else if (r < 0.45) score += 2;
  else if (r < 0.75) score += 1;
  if (waterAccess) score += 2;
  if (buildings > 0) score += 2;
  if (lit) score += 1;
  if (trees > 0) score += 1;
  if (outOfBounds) score = 0;

  const rarity: Rarity =
    score >= 7 ? "Legendary" : score >= 5 ? "Rare" : score >= 3 ? "Uncommon" : "Common";

  return {
    plotId: gridX * GRID_COLS + gridZ,
    gridX,
    gridZ,
    centerX: b.centerX,
    centerZ: b.centerZ,
    size: LIMITS.plotSize,
    distance: Math.round(distance),
    zone,
    rarity,
    waterAccess,
    waterDistance: nearestWater === null ? null : Math.round(nearestWater),
    lit,
    buildings,
    trees,
    outOfBounds,
  };
}

export const PLOT_COUNT = GRID_COLS * GRID_COLS;

export function allPlotTraits(map: MapDef): PlotTraits[] {
  const out: PlotTraits[] = [];
  for (let gx = 0; gx < GRID_COLS; gx++) {
    for (let gz = 0; gz < GRID_COLS; gz++) out.push(traitsFor(gx, gz, map));
  }
  return out;
}
