import { Activity, Flame, Footprints, HeartPulse, Moon } from "lucide-react";

import type { DailySummary } from "@/lib/db/health";

/**
 * Presentational health dashboard: today's headline metrics as tiles plus a
 * lightweight 7-day steps bar chart (plain divs, matching the app's other
 * inline charts — no charting dependency).
 */
export function HealthSummary({
  latest,
  week,
}: {
  latest: DailySummary | null;
  week: DailySummary[];
}) {
  const tiles = [
    { icon: Footprints, label: "ခြေလှမ်း", value: latest?.steps, unit: "" },
    { icon: HeartPulse, label: "နှလုံးခုန်", value: latest?.avg_hr, unit: "bpm" },
    {
      icon: Moon,
      label: "အိပ်ချိန်",
      value: latest?.sleep_minutes != null ? Math.round(latest.sleep_minutes / 60) : null,
      unit: "နာရီ",
    },
    { icon: Flame, label: "ကယ်လိုရီ", value: latest?.calories, unit: "kcal" },
    { icon: Activity, label: "လှုပ်ရှားချိန်", value: latest?.active_minutes, unit: "မိနစ်" },
  ];

  const maxSteps = Math.max(1, ...week.map((d) => d.steps ?? 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <t.icon className="h-4 w-4 text-primary" />
              {t.label}
            </div>
            <p className="mt-1 text-xl font-bold">
              {t.value != null ? t.value.toLocaleString() : "—"}
              {t.value != null && t.unit ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {t.unit}
                </span>
              ) : null}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-medium">၇ ရက် ခြေလှမ်း</p>
        {week.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            data မရှိသေးပါ — စက်ချိတ်ပြီး တစ်ရက်လောက် စောင့်ပါ။
          </p>
        ) : (
          <div className="flex h-32 items-end gap-2">
            {week.map((d) => (
              <div
                key={d.day}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-[10px] text-muted-foreground">
                  {d.steps != null ? (d.steps / 1000).toFixed(1) + "k" : ""}
                </span>
                <div
                  className="w-full rounded-t bg-primary"
                  style={{
                    height: `${Math.max(4, ((d.steps ?? 0) / maxSteps) * 100)}px`,
                  }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {d.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
