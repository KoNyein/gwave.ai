"use client";

import { Table2 } from "lucide-react";
import { useLocale } from "next-intl";

import { prefersMyanmarScript } from "@/i18n/config";

import type { DailySummary } from "@/lib/db/health";

function fmt(v: number | null): string {
  return v != null ? v.toLocaleString() : "—";
}

function fmtMinutes(v: number | null, mm: boolean): string {
  if (v == null) return "—";
  const h = Math.floor(v / 60);
  if (mm) return h > 0 ? `${h}နာရီ ${v % 60}မိနစ်` : `${v}မိနစ်`;
  return h > 0 ? `${h}h ${v % 60}m` : `${v}m`;
}

/**
 * Details view: one row per day with every tracked metric, newest first —
 * the raw numbers behind the headline tiles and the steps chart.
 */
export function HealthDetails({ week }: { week: DailySummary[] }) {
  const mm = prefersMyanmarScript(useLocale());
  if (week.length === 0) return null;
  const rows = [...week].reverse();

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Table2 className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">{mm ? "အသေးစိတ် data (၇ ရက်)" : "Details (7 days)"}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{mm ? "နေ့" : "Day"}</th>
              <th className="py-2 pr-3 font-medium">{mm ? "ခြေလှမ်း" : "Steps"}</th>
              <th className="py-2 pr-3 font-medium">{mm ? "နှလုံးခုန်" : "Heart"}</th>
              <th className="py-2 pr-3 font-medium">{mm ? "အိပ်ချိန်" : "Sleep"}</th>
              <th className="py-2 pr-3 font-medium">{mm ? "ကယ်လိုရီ" : "Calories"}</th>
              <th className="py-2 pr-3 font-medium">{mm ? "လှုပ်ရှားချိန်" : "Active"}</th>
              <th className="py-2 font-medium">Screen time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.day} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{d.day.slice(5)}</td>
                <td className="py-2 pr-3">{fmt(d.steps)}</td>
                <td className="py-2 pr-3">
                  {d.avg_hr != null ? `${d.avg_hr} bpm` : "—"}
                </td>
                <td className="py-2 pr-3">{fmtMinutes(d.sleep_minutes, mm)}</td>
                <td className="py-2 pr-3">{fmt(d.calories)}</td>
                <td className="py-2 pr-3">{fmtMinutes(d.active_minutes, mm)}</td>
                <td className="py-2">{fmtMinutes(d.screen_minutes, mm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
