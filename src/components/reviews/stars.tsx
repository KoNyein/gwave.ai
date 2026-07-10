import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Read-only star display for an average rating (supports half-ish via fill). */
export function Stars({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        return (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={cn(
              filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40",
            )}
          />
        );
      })}
    </span>
  );
}
