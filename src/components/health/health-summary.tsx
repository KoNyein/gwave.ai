"use client";

import {
  Activity,
  Flame,
  Footprints,
  HeartPulse,
  Moon,
  Smartphone,
} from "lucide-react";
import { useLocale } from "next-intl";

import type { DailySummary } from "@/lib/db/health";
import { prefersMyanmarScript } from "@/i18n/config";

/**
 * Headline tiles for today's metrics. The 7-day history lives in HealthCharts;
 * this stays a compact, scannable grid. English-first labels with Burmese for
 * Myanmar locales.
 */
export function HealthSummary({ latest }: { latest: DailySummary | null }) {
  const mm = prefersMyanmarScript(useLocale());

  const tiles = [
    {
      icon: Footprints,
      en: "Steps",
      my: "ခြေလှမ်း",
      value: latest?.steps,
      unit: "",
    },
    {
      icon: HeartPulse,
      en: "Heart rate",
      my: "နှလုံးခုန်",
      value: latest?.avg_hr,
      unit: "bpm",
    },
    {
      icon: Moon,
      en: "Sleep",
      my: "အိပ်ချိန်",
      value:
        latest?.sleep_minutes != null
          ? Math.round((latest.sleep_minutes / 60) * 10) / 10
          : null,
      unit: mm ? "နာရီ" : "hr",
    },
    {
      icon: Flame,
      en: "Calories",
      my: "ကယ်လိုရီ",
      value: latest?.calories,
      unit: "kcal",
    },
    {
      icon: Activity,
      en: "Active",
      my: "လှုပ်ရှားချိန်",
      value: latest?.active_minutes,
      unit: mm ? "မိနစ်" : "min",
    },
    {
      icon: Smartphone,
      en: "Screen time",
      my: "Screen time",
      value: latest?.screen_minutes,
      unit: mm ? "မိနစ်" : "min",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.en} className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <t.icon className="h-4 w-4 text-primary" />
            {mm ? t.my : t.en}
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
  );
}
