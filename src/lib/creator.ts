// Creator gamification tiers — maps a member's creator points to a badge, to
// motivate building and sharing games in the community.

export interface CreatorTier {
  key: string;
  label: string;
  emoji: string;
  /** Minimum points to reach this tier. */
  min: number;
}

/** Ordered high → low; first match wins. */
export const CREATOR_TIERS: CreatorTier[] = [
  { key: "legend", label: "ကျော်ကြား Creator", emoji: "👑", min: 1000 },
  { key: "popular", label: "ရေပန်းစား Creator", emoji: "🔥", min: 300 },
  { key: "rising", label: "တက်လာ Creator", emoji: "⭐", min: 100 },
  { key: "new", label: "Creator အသစ်", emoji: "🌱", min: 1 },
];

export function creatorTier(points: number): CreatorTier | null {
  return CREATOR_TIERS.find((t) => points >= t.min) ?? null;
}

/** Points to the next tier (for a progress hint), or null at the top. */
export function nextCreatorTier(points: number): CreatorTier | null {
  const higher = [...CREATOR_TIERS]
    .reverse()
    .find((t) => t.min > points);
  return higher ?? null;
}
