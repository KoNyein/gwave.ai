"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailySummary } from "@/lib/db/health";
import { prefersMyanmarScript } from "@/i18n/config";

type MetricKey =
  | "steps"
  | "sleep"
  | "heart"
  | "calories"
  | "active"
  | "screen";

interface MetricDef {
  key: MetricKey;
  en: string;
  my: string;
  unitEn: string;
  unitMy: string;
  chart: "bar" | "area" | "line";
  value: (d: DailySummary) => number | null;
}

const METRICS: MetricDef[] = [
  {
    key: "steps",
    en: "Steps",
    my: "ခြေလှမ်း",
    unitEn: "steps",
    unitMy: "လှမ်း",
    chart: "bar",
    value: (d) => d.steps,
  },
  {
    key: "sleep",
    en: "Sleep",
    my: "အိပ်ချိန်",
    unitEn: "hours",
    unitMy: "နာရီ",
    chart: "area",
    value: (d) =>
      d.sleep_minutes != null ? Math.round((d.sleep_minutes / 60) * 10) / 10 : null,
  },
  {
    key: "heart",
    en: "Heart rate",
    my: "နှလုံးခုန်",
    unitEn: "bpm",
    unitMy: "bpm",
    chart: "line",
    value: (d) => d.avg_hr,
  },
  {
    key: "calories",
    en: "Calories",
    my: "ကယ်လိုရီ",
    unitEn: "kcal",
    unitMy: "kcal",
    chart: "area",
    value: (d) => d.calories,
  },
  {
    key: "active",
    en: "Active",
    my: "လှုပ်ရှားချိန်",
    unitEn: "min",
    unitMy: "မိနစ်",
    chart: "bar",
    value: (d) => d.active_minutes,
  },
  {
    key: "screen",
    en: "Screen time",
    my: "Screen time",
    unitEn: "min",
    unitMy: "မိနစ်",
    chart: "bar",
    value: (d) => d.screen_minutes,
  },
];

/**
 * Interactive 7-day charts for the health dashboard: pick a metric, see the
 * right chart shape for it (bars for counts, area for volumes, line for
 * rates). Missing days render as gaps instead of stretching one lonely bar
 * across the card. English-first labels with Burmese for Myanmar locales.
 */
export function HealthCharts({ week }: { week: DailySummary[] }) {
  const mm = prefersMyanmarScript(useLocale());
  const [metricKey, setMetricKey] = React.useState<MetricKey>("steps");
  const metric: MetricDef =
    METRICS.find((m) => m.key === metricKey) ?? METRICS[0]!;

  // Always chart a full 7-day window so a single logged day doesn't become
  // one full-width bar; days without data stay empty.
  const byDay = new Map(week.map((d) => [d.day, d]));
  const data = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    const row = byDay.get(iso);
    return {
      day: iso.slice(5),
      value: row ? metric.value(row) : null,
    };
  });

  const values = data
    .map((d) => d.value)
    .filter((v): v is number => v != null);
  const total = values.reduce((s, v) => s + v, 0);
  const summary =
    metric.key === "heart"
      ? values.length
        ? Math.round(total / values.length)
        : null
      : values.length
        ? Math.round(total * 10) / 10
        : null;
  const unit = mm ? metric.unitMy : metric.unitEn;

  const common = {
    data,
    margin: { top: 8, right: 8, left: -18, bottom: 0 },
  };
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
      <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} />
      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
      <Tooltip
        formatter={(value) => [`${value} ${unit}`, mm ? metric.my : metric.en]}
        labelStyle={{ fontSize: 12 }}
        contentStyle={{ fontSize: 12, borderRadius: 8 }}
      />
    </>
  );

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">
          {mm ? "၇ ရက် graph" : "7-day charts"}
        </p>
        {summary != null ? (
          <p className="text-sm text-muted-foreground">
            {metric.key === "heart"
              ? mm
                ? `ပျမ်းမျှ ${summary} ${unit}`
                : `avg ${summary} ${unit}`
              : mm
                ? `စုစုပေါင်း ${summary.toLocaleString()} ${unit}`
                : `total ${summary.toLocaleString()} ${unit}`}
          </p>
        ) : null}
      </div>

      {/* Metric picker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetricKey(m.key)}
            className={
              m.key === metric.key
                ? "shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            }
          >
            {mm ? m.my : m.en}
          </button>
        ))}
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {metric.chart === "bar" ? (
            <BarChart {...common}>
              {axes}
              <Bar
                dataKey="value"
                fill="hsl(var(--primary))"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          ) : metric.chart === "area" ? (
            <AreaChart {...common}>
              {axes}
              <Area
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.25)"
                strokeWidth={2}
                connectNulls
              />
            </AreaChart>
          ) : (
            <LineChart {...common}>
              {axes}
              <Line
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {values.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {mm
            ? "ဒီ metric အတွက် data မရှိသေးပါ — စက်ချိတ်ပါ သို့မဟုတ် ကိုယ်တိုင်မှတ်တမ်းတင်ပါ။"
            : "No data yet for this metric — connect a device or log it manually."}
        </p>
      ) : null}
    </div>
  );
}
