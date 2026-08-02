/// User-generated building — data model နဲ့ validation (Phase 18)。
///
/// ★ **Client ရော server ရော ဒီ file တစ်ခုတည်းကို သုံးတယ်**。 Validation က
///   ၂ နေရာ ကွဲနေရင် client က ခွင့်ပြုပြီး server က ငြင်းတာမျိုး ဖြစ်တယ်
///   (ဒါမှမဟုတ် ပိုဆိုးတာက ပြောင်းပြန်)。
/// ★ Client ရဲ့ validation က **အဆင်ပြေဖို့သာ** — အမှန်တရားက server မှာ။
///   API ကို တိုက်ရိုက်ခေါ်ပြီး ဘယ်လို JSON မဆို ပို့လို့ရတယ်။

export type BuildObject = {
  /// ပစ္စည်းအမျိုးအစား — whitelist ထဲက တစ်ခု
  t: string;
  x: number;
  y: number;
  z: number;
  /// 0 | 90 | 180 | 270 သာ (ဒီဂရီ)
  ry: number;
  sx?: number;
  sy?: number;
  sz?: number;
  c?: number;
  /// ဆိုင်းဘုတ်စာသား — ★ moderation လိုတယ်
  txt?: string;
};

export type BuildData = {
  v: 1;
  plotId: number;
  objects: BuildObject[];
  ground?: { color: number };
};

/// ★ Whitelist — မသိတဲ့ type ကို ခွင့်ပြုရင် client က `t: "__proto__"` လို
/// အရာမျိုး ပို့ပြီး renderer ကို ရှုပ်စေလို့ရမယ်။
export const BUILD_TYPES = [
  "wall",
  "floor",
  "roof",
  "door",
  "window",
  "fence",
  "tree",
  "lamp",
  "chair",
  "table",
  "sign",
] as const;

export type BuildType = (typeof BUILD_TYPES)[number];

export const ALLOWED_TYPES: ReadonlySet<string> = new Set(BUILD_TYPES);

export const LIMITS = {
  maxObjects: 200,
  maxScale: 4,
  minScale: 0.5,
  maxSignLength: 40,
  /// ကွက်တစ်ကွက်ရဲ့ အနံ (unit)
  plotSize: 16,
  maxHeight: 12,
  /// Undo stack ရဲ့ အနက်
  undoDepth: 50,
} as const;

/// ★ Grid snap ရဲ့ အကြောင်းရင်း ၄ ခု: နံရံတွေ အံကိုက်ဆက်လို့ရ · collider
/// တွက်ရလွယ် · data သေး · Minecraft လို ခံစားချက်ရ。
export const GRID = 0.5;

export const snap = (n: number) => Math.round(n / GRID) * GRID;

/// plotId → grid coordinate。 `plot_id = gx * 32 + gz` (metaverse.sql)。
export const GRID_COLS = 32;

export function plotCenter(plotId: number): { x: number; z: number } {
  const gx = Math.floor(plotId / GRID_COLS);
  const gz = plotId % GRID_COLS;
  // ကွက်တွေက origin ကို ဗဟိုပြုပြီး ခြေရာလိုက် ချထားတယ်
  return {
    x: (gx - GRID_COLS / 2) * LIMITS.plotSize + LIMITS.plotSize / 2,
    z: (gz - GRID_COLS / 2) * LIMITS.plotSize + LIMITS.plotSize / 2,
  };
}

export type BuildError =
  | "too_many_objects"
  | "bad_type"
  | "out_of_plot"
  | "not_snapped"
  | "bad_rotation"
  | "bad_scale"
  | "text_too_long"
  | "bad_shape";

/// မှားနေရင် error code၊ မှန်ရင် `null`。
///
/// ★ **Throw မလုပ်ဘူး** — client မှာလည်း ဒီ function ကိုပဲ သုံးပြီး
///   "ဒီနေရာမှာ မချရဘူး" လို့ ကြိုပြရမယ်။ Exception နဲ့ ဆိုရင် render loop
///   ထဲမှာ သုံးလို့ မဆင်ပြေဘူး။
export function validateBuild(
  raw: unknown,
  plot: { centerX: number; centerZ: number },
): { ok: true; build: BuildData } | { ok: false; error: BuildError } {
  const b = (raw ?? {}) as Partial<BuildData>;
  if (!Array.isArray(b.objects)) return { ok: false, error: "bad_shape" };
  if (b.objects.length > LIMITS.maxObjects) {
    return { ok: false, error: "too_many_objects" };
  }

  const objects: BuildObject[] = [];
  for (const raw0 of b.objects) {
    const o = (raw0 ?? {}) as Partial<BuildObject>;
    const t = String(o.t ?? "");
    if (!ALLOWED_TYPES.has(t)) return { ok: false, error: "bad_type" };

    const x = Number(o.x);
    const y = Number(o.y);
    const z = Number(o.z);
    const ry = Number(o.ry);
    if (![x, y, z, ry].every(Number.isFinite)) return { ok: false, error: "bad_shape" };

    // ★ ကိုယ့်ကွက်ထဲမှာသာ — ဘေးကွက် ကျော်လို့မရ။ ဒါက ဒီ phase ရဲ့
    // အရေးအကြီးဆုံး စစ်ဆေးမှု: မရှိရင် ဘယ်သူမဆို တခြားသူ့ကွက်ပေါ်
    // (ဒါမှမဟုတ် လောကတစ်ခုလုံးပေါ်) ဆောက်လို့ရသွားမယ်။
    const half = LIMITS.plotSize / 2;
    if (Math.abs(x - plot.centerX) > half) return { ok: false, error: "out_of_plot" };
    if (Math.abs(z - plot.centerZ) > half) return { ok: false, error: "out_of_plot" };
    if (y < 0 || y > LIMITS.maxHeight) return { ok: false, error: "out_of_plot" };

    // ★ Grid snap — client ကမလုပ်ဘဲ ပို့ရင် ငြင်းတယ်။ Float နဲ့
    // နှိုင်းယှဉ်တာမို့ epsilon သုံးရမယ် (0.1+0.2 !== 0.3)。
    if (!isSnapped(x) || !isSnapped(z)) return { ok: false, error: "not_snapped" };
    if (!isSnapped(y)) return { ok: false, error: "not_snapped" };
    if (![0, 90, 180, 270].includes(ry)) return { ok: false, error: "bad_rotation" };

    const scale = (v: unknown): number => {
      const n = Number(v ?? 1);
      return Number.isFinite(n) ? n : NaN;
    };
    const sx = scale(o.sx);
    const sy = scale(o.sy);
    const sz = scale(o.sz);
    for (const s of [sx, sy, sz]) {
      if (!Number.isFinite(s) || s < LIMITS.minScale || s > LIMITS.maxScale) {
        return { ok: false, error: "bad_scale" };
      }
    }

    let txt: string | undefined;
    if (o.txt != null) {
      // ★ Control character တွေ ဖယ် — ဆိုင်းဘုတ်ပေါ်မှာ layout ဖျက်လို့ရတယ်
      txt = String(o.txt).replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
      if (txt.length > LIMITS.maxSignLength) return { ok: false, error: "text_too_long" };
    }

    const c = Number(o.c);
    objects.push({
      t,
      x,
      y,
      z,
      ry,
      sx,
      sy,
      sz,
      c: Number.isFinite(c) && c >= 0 && c <= 0xffffff ? c : 0xcfcfcf,
      ...(txt ? { txt } : {}),
    });
  }

  const groundColor = Number(b.ground?.color);
  return {
    ok: true,
    build: {
      v: 1,
      plotId: Number(b.plotId) || 0,
      objects,
      ...(Number.isFinite(groundColor) && groundColor >= 0 && groundColor <= 0xffffff
        ? { ground: { color: groundColor } }
        : {}),
    },
  };
}

function isSnapped(n: number): boolean {
  const r = Math.abs(n / GRID - Math.round(n / GRID));
  return r < 1e-6;
}

/// UI မှာ ပြဖို့ — အမှားတစ်ခုချင်းရဲ့ မြန်မာလို ရှင်းလင်းချက်
export const BUILD_ERROR_MY: Record<BuildError, string> = {
  too_many_objects: `ပစ္စည်း ${LIMITS.maxObjects} ခုထက် မပိုရပါ`,
  bad_type: "မသိတဲ့ ပစ္စည်းအမျိုးအစား",
  out_of_plot: "ကိုယ့်ကွက်အပြင်ဘက် ရောက်နေပါတယ်",
  not_snapped: "အကွက်ပေါ် အံမကိုက်သေးပါ",
  bad_rotation: "လှည့်ထောင့်က ၀/၉၀/၁၈၀/၂၇၀ သာ ဖြစ်ရပါမယ်",
  bad_scale: `အရွယ်က ${LIMITS.minScale}–${LIMITS.maxScale} ကြားသာ`,
  text_too_long: `စာသား ${LIMITS.maxSignLength} လုံးထက် မပိုရပါ`,
  bad_shape: "ပုံစံ မမှန်ပါ",
};
