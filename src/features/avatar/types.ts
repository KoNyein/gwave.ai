/// 🧬 3D Face/Body Scan Avatar System — shared types (Phase 1)
/// Spec: GWAVE_METAVERSE_AVATAR_SPEC.md
///
/// ★ Morph value convention — **[-1, 1] normalized** against the base
///   body's reference measurements (spec §5.2)။ Scan က starting point ပဲ၊
///   user က slider နဲ့ အမြဲ ပြင်လို့ရတယ်။

/// §5.2 — base body မှာ ပါရမယ့် morph target ၁၁ ခု
export const MORPH_KEYS = [
  "height",
  "shoulderWidth",
  "chestDepth",
  "waist",
  "hips",
  "armLength",
  "legLength",
  "muscle",
  "weight",
  "neckLength",
  "headScale",
] as const;

export type MorphKey = (typeof MORPH_KEYS)[number];

export type MorphWeights = Partial<Record<MorphKey, number>>;

export type BodyType = "m" | "f";

export type ScanSource = "none" | "face" | "face+body";

/// DB row ↔ API ↔ editor တစ်လျှောက် သုံးတဲ့ config တစ်ခုတည်း
export type AvatarConfig = {
  faceGlbUrl: string | null;
  faceThumbUrl: string | null;
  bodyType: BodyType;
  morphs: MorphWeights;
  skinColor: string; // #rrggbb
  hairId: string | null;
  hairColor: string | null;
  outfitId: string;
  accessories: string[];
  scanSource: ScanSource;
  /// Cache-busting — version ပြောင်းမှ room client တွေ asset ပြန်ဆွဲတယ်
  version: number;
};

export type AvatarAssetKind = "outfit" | "hair" | "body" | "accessory";

export type AvatarAsset = {
  id: string;
  kind: AvatarAssetKind;
  name: string;
  glbUrl: string;
  thumbUrl: string | null;
  isDefault: boolean;
  price: number;
  owned: boolean;
};

export const DEFAULT_SCAN_AVATAR: AvatarConfig = {
  faceGlbUrl: null,
  faceThumbUrl: null,
  bodyType: "m",
  morphs: {},
  skinColor: "#c99e7f",
  hairId: null,
  hairColor: null,
  outfitId: "casual_01",
  accessories: [],
  scanSource: "none",
  version: 1,
};

/// Fitzpatrick-range palette (spec §8 Skin tab)
export const SKIN_SWATCHES = [
  "#f6ede4",
  "#f0dcc8",
  "#e8c5a5",
  "#deb28a",
  "#c99e7f",
  "#b98865",
  "#a06e4a",
  "#8b5a3a",
  "#74472c",
  "#5d3a24",
  "#4a2e1c",
  "#3a2416",
] as const;

/// Morph slider labels — Burmese UI (code stays English)
export const MORPH_LABELS: Record<MorphKey, string> = {
  height: "အရပ်",
  shoulderWidth: "ပခုံးအကျယ်",
  chestDepth: "ရင်အုပ်ထူ",
  waist: "ခါး",
  hips: "တင်ပါး",
  armLength: "လက်အရှည်",
  legLength: "ခြေအရှည်",
  muscle: "ကြွက်သား",
  weight: "ကိုယ်ချိန်",
  neckLength: "လည်ပင်း",
  headScale: "ခေါင်းအရွယ်",
};

/// Morph weight တစ်ခုကို [-1,1] အတွင်း ကန့်သတ် — API ရော editor ရော သုံး
export function clampMorph(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

/// Server/client နှစ်ဖက်လုံးက သုံးတဲ့ sanitizer — မသိတဲ့ key ဖယ်၊ clamp
export function sanitizeMorphs(raw: unknown): MorphWeights {
  const out: MorphWeights = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of MORPH_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = clampMorph(v);
  }
  return out;
}
