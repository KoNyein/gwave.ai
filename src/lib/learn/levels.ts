// Learning levels: named tiers computed from learning points.
// Points come from the learning_points() database function:
//   completed lesson = 10 pts, started lesson = 2 pts, plus quiz score / 10.

export interface LearnLevel {
  /** 1-based level number. */
  level: number;
  name: string;
  emoji: string;
  /** Points needed to reach this tier. */
  min: number;
}

export const LEVELS: LearnLevel[] = [
  { level: 1, name: "Seedling", emoji: "🌱", min: 0 },
  { level: 2, name: "Sprout", emoji: "🌿", min: 30 },
  { level: 3, name: "Coder", emoji: "💻", min: 80 },
  { level: 4, name: "Builder", emoji: "🛠️", min: 150 },
  { level: 5, name: "Pro", emoji: "⚡", min: 250 },
  { level: 6, name: "Master", emoji: "🏆", min: 400 },
];

export interface LevelProgress {
  current: LearnLevel;
  next: LearnLevel | null;
  points: number;
  /** 0–100 progress toward the next tier (100 at max level). */
  pct: number;
}

export function levelForPoints(points: number): LevelProgress {
  let current = LEVELS[0]!;
  for (const tier of LEVELS) {
    if (points >= tier.min) current = tier;
  }
  const next = LEVELS[LEVELS.indexOf(current) + 1] ?? null;
  const pct = next
    ? Math.min(
        100,
        Math.round(((points - current.min) / (next.min - current.min)) * 100),
      )
    : 100;
  return { current, next, points, pct };
}
