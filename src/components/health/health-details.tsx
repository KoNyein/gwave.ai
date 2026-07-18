import { Table2 } from "lucide-react";

import type { DailySummary } from "@/lib/db/health";

function fmt(v: number | null): string {
  return v != null ? v.toLocaleString() : "—";
}

function fmtMinutes(v: number | null): string {
  if (v == null) return "—";
  const h = Math.floor(v / 60);
  return h > 0 ? `${h}နာရီ ${v % 60}မိနစ်` : `${v}မိနစ်`;
}

/**
 * Details view: one row per day with every tracked metric, newest first —
 * the raw numbers behind the headline tiles and the steps chart.
 */
export function HealthDetails({ week }: { week: DailySummary[] }) {
  if (week.length === 0) return null;
  const rows = [...week].reverse();

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Table2 className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">အသေးစိတ် data (၇ ရက်)</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">နေ့</th>
              <th className="py-2 pr-3 font-medium">ခြေလှမ်း</th>
              <th className="py-2 pr-3 font-medium">နှလုံးခုန်</th>
              <th className="py-2 pr-3 font-medium">အိပ်ချိန်</th>
              <th className="py-2 pr-3 font-medium">ကယ်လိုရီ</th>
              <th className="py-2 pr-3 font-medium">လှုပ်ရှားချိန်</th>
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
                <td className="py-2 pr-3">{fmtMinutes(d.sleep_minutes)}</td>
                <td className="py-2 pr-3">{fmt(d.calories)}</td>
                <td className="py-2 pr-3">{fmtMinutes(d.active_minutes)}</td>
                <td className="py-2">{fmtMinutes(d.screen_minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
