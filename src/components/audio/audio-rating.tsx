"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Interactive 5-star rating for a track. Upserts to /api/audio/{id}/rating and
 * refreshes so the average updates. Accessible: a radiogroup of star buttons.
 */
export function AudioRating({
  trackId,
  mine,
}: {
  trackId: string;
  mine: number | null;
}) {
  const t = useTranslations("audio");
  const router = useRouter();
  const [value, setValue] = React.useState(mine ?? 0);
  const [hover, setHover] = React.useState(0);
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function rate(stars: number) {
    setValue(stars);
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/audio/${trackId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || value;

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{t("yourRating")}</p>
      <div role="radiogroup" aria-label={t("yourRating")} className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}`}
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => rate(n)}
            className="p-0.5"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                n <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
        {saved && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">{t("thanks")}</span>}
      </div>
    </div>
  );
}

/** Read-only average display (star + number + count). */
export function RatingSummary({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="font-medium text-foreground">{avg.toFixed(1)}</span>
      <span>({count})</span>
    </span>
  );
}
