"use client";

import * as React from "react";
import { Banknote, Clock, Eye, Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CreatorStatBucket } from "@/types/database";

type Metric = "earnings" | "views" | "likes" | "watchSeconds";

const METRICS: { key: Metric; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "earnings", label: "ဝင်ငွေ ($)", icon: <Banknote className="h-4 w-4" />, color: "bg-emerald-500" },
  { key: "views", label: "ကြည့်ရှုမှု", icon: <Eye className="h-4 w-4" />, color: "bg-blue-500" },
  { key: "likes", label: "Like", icon: <Heart className="h-4 w-4" />, color: "bg-rose-500" },
  { key: "watchSeconds", label: "ကြည့်ချိန်", icon: <Clock className="h-4 w-4" />, color: "bg-amber-500" },
];

function fmt(metric: Metric, v: number): string {
  if (metric === "watchSeconds") {
    const h = Math.floor(v / 3600);
    const m = Math.floor((v % 3600) / 60);
    const s = Math.floor(v % 60);
    return [h ? `${h}နာ` : "", m || h ? `${m}မိ` : "", `${s}စ`].filter(Boolean).join(" ");
  }
  if (metric === "earnings")
    return `$${v.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return v.toLocaleString("en-US");
}

export function CreatorAnalytics({
  daily,
  monthly,
}: {
  daily: CreatorStatBucket[];
  monthly: CreatorStatBucket[];
}) {
  const [range, setRange] = React.useState<"daily" | "monthly">("daily");
  const [metric, setMetric] = React.useState<Metric>("earnings");

  const rows = range === "daily" ? daily : monthly;
  // Newest first for the chart/table.
  const ordered = React.useMemo(() => [...rows].reverse(), [rows]);
  const max = Math.max(1, ...ordered.map((r) => r[metric]));

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">📊 အသေးစိတ် စာရင်း</h2>
        <div className="flex rounded-lg border p-0.5 text-xs">
          {(["daily", "monthly"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium",
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {r === "daily" ? "နေ့စဉ်" : "လစဉ်"}
            </button>
          ))}
        </div>
      </div>

      {/* Metric selector */}
      <div className="flex flex-wrap gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium",
              metric === m.key ? "border-primary bg-primary/10" : "text-muted-foreground",
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {ordered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          ဒေတာ မရှိသေးပါ — Reel တင်ပြီး ကြည့်ရှုမှု ရလာရင် ဒီမှာ ပေါ်ပါလိမ့်မယ်။
        </p>
      ) : (
        <>
          {/* Bar chart */}
          <div className="space-y-1.5">
            {ordered.map((r) => (
              <div key={r.period} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 tabular-nums text-muted-foreground">
                  {range === "daily" ? r.period.slice(5) : r.period}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className={cn("h-full rounded", METRICS.find((m) => m.key === metric)?.color)}
                    style={{ width: `${Math.max(2, (r[metric] / max) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                  {fmt(metric, r[metric])}
                </span>
              </div>
            ))}
          </div>

          {/* Full table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-2">{range === "daily" ? "နေ့" : "လ"}</th>
                  <th className="py-1.5 pr-2 text-right">ကြည့်ရှု</th>
                  <th className="py-1.5 pr-2 text-right">Like</th>
                  <th className="py-1.5 pr-2 text-right">ကြည့်ချိန်</th>
                  <th className="py-1.5 text-right">ဝင်ငွေ</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((r) => (
                  <tr key={r.period} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 tabular-nums">{r.period}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.views.toLocaleString("en-US")}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.likes.toLocaleString("en-US")}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmt("watchSeconds", r.watchSeconds)}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{fmt("earnings", r.earnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
