import type { ThreatKind } from "@/types/database";

/**
 * Per-threat warning radius (km) and Burmese label/emoji. Fast, wide threats
 * (jets) warn a larger area; a ground assault is more local. Kept out of the
 * "use server" action file so both client and server can import it.
 */
export const THREAT_META: Record<
  ThreatKind,
  { emoji: string; label: string; radiusKm: number }
> = {
  airstrike: { emoji: "✈️", label: "လေကြောင်းတိုက်ခိုက်မှု", radiusKm: 25 },
  artillery: { emoji: "💥", label: "အမြောက်/လက်နက်ကြီး", radiusKm: 15 },
  drone: { emoji: "🛩️", label: "ဒရုန်း", radiusKm: 10 },
  ground: { emoji: "⚠️", label: "မြေပြင်တပ်", radiusKm: 6 },
  disaster: { emoji: "🌊", label: "သဘာဝဘေး", radiusKm: 12 },
  other: { emoji: "❗", label: "အခြားအန္တရာယ်", radiusKm: 10 },
};

/** Compass bearing (degrees) → Burmese direction the threat is coming from. */
export function bearingLabelMy(heading: number | null | undefined): string | null {
  if (heading == null || Number.isNaN(heading)) return null;
  const dirs = [
    "မြောက်",
    "အရှေ့မြောက်",
    "အရှေ့",
    "အရှေ့တောင်",
    "တောင်",
    "အနောက်တောင်",
    "အနောက်",
    "အနောက်မြောက်",
  ];
  return `${dirs[Math.round(heading / 45) % 8]}ဘက်`;
}
