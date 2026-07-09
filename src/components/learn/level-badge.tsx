import { levelForPoints } from "@/lib/learn/levels";

/**
 * Learning-level badge: tier emoji + name + points, with a progress bar
 * toward the next tier. Server component — pass the points in.
 */
export function LevelBadge({
  points,
  compact = false,
}: {
  points: number;
  compact?: boolean;
}) {
  const progress = levelForPoints(points);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
        <span aria-hidden>{progress.current.emoji}</span>
        Lv.{progress.current.level} {progress.current.name}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="text-lg" aria-hidden>
            {progress.current.emoji}
          </span>
          Level {progress.current.level} · {progress.current.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {progress.points} pts
          {progress.next
            ? ` · ${progress.next.min - progress.points} to ${progress.next.name}`
            : " · max level!"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
    </div>
  );
}
