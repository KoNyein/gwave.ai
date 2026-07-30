"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModuleSection } from "@/lib/db/admin";

/**
 * System-wide data display: every module's row counts as bar charts, so the
 * shape of the system is visible at a glance instead of read cell by cell.
 * Sections come straight from getModuleMetrics (one admin-client head-count
 * per table), so this page adds no new queries.
 *
 * Counts across modules differ by orders of magnitude (a handful of stores vs.
 * hundreds of thousands of reactions), so each section is charted on its own
 * scale, with a log-scale toggle for when one metric dwarfs its neighbours.
 */

const PALETTE = [
  "#2563eb",
  "#16a34a",
  "#f0b429",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#65a30d",
];

export function SystemDataCharts({ sections }: { sections: ModuleSection[] }) {
  const [log, setLog] = React.useState(false);
  const [showZero, setShowZero] = React.useState(false);

  const totals = React.useMemo(
    () =>
      sections
        .map((s) => ({
          label: s.title.replace(/^\p{Emoji}+\s*/u, ""),
          count: s.metrics.reduce((sum, m) => sum + (m.value ?? 0), 0),
          recent: s.metrics.reduce((sum, m) => sum + (m.recent ?? 0), 0),
        }))
        .sort((a, b) => b.count - a.count),
    [sections],
  );

  const grandTotal = totals.reduce((s, r) => s + r.count, 0);
  const grandRecent = totals.reduce((s, r) => s + r.recent, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">စုစုပေါင်း record</p>
            <p className="text-xl font-bold tabular-nums">
              {grandTotal.toLocaleString("en-US")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">၇ ရက်အတွင်း အသစ်</p>
            <p className="text-xl font-bold tabular-nums text-emerald-600">
              +{grandRecent.toLocaleString("en-US")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Module</p>
            <p className="text-xl font-bold tabular-nums">{sections.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Metric</p>
            <p className="text-xl font-bold tabular-nums">
              {sections.reduce(
                (n, s) => n + s.metrics.filter((m) => m.value !== null).length,
                0,
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 px-1">
        <button
          type="button"
          onClick={() => setLog((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            log
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground"
          }`}
        >
          Log scale
        </button>
        <button
          type="button"
          onClick={() => setShowZero((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            showZero
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground"
          }`}
        >
          သုည/မရှိသော metric ပြ
        </button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Module အလိုက် စုစုပေါင်း record
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={totals} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
              <XAxis
                type="number"
                fontSize={11}
                allowDecimals={false}
                scale={log ? "log" : "auto"}
                domain={log ? [1, "auto"] : undefined}
                allowDataOverflow={log}
              />
              <YAxis
                type="category"
                dataKey="label"
                fontSize={10}
                width={130}
              />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {totals.map((r, i) => (
                  <Cell key={r.label} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {sections.map((section, si) => {
        const rows = section.metrics
          .filter((m) => (showZero ? true : (m.value ?? 0) > 0))
          .map((m) => ({
            label: m.label,
            count: m.value ?? 0,
            recent: m.recent ?? 0,
          }))
          .sort((a, b) => b.count - a.count);
        if (rows.length === 0) return null;
        const colour = PALETTE[si % PALETTE.length];
        return (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{section.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{section.hint}</p>
            </CardHeader>
            <CardContent
              style={{ height: Math.max(160, rows.length * 26 + 48) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                  <XAxis
                    type="number"
                    fontSize={11}
                    allowDecimals={false}
                    scale={log ? "log" : "auto"}
                    domain={log ? [1, "auto"] : undefined}
                    allowDataOverflow={log}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    fontSize={10}
                    width={130}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill={colour} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="recent" fill="#10b981" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        အစိမ်းရောင် bar = ပြီးခဲ့သည့် ၇ ရက်အတွင်း အသစ် (ရနိုင်သည့် table
        များအတွက်သာ)။ ဒေတာအားလုံးကို RLS bypass လုပ်သည့် admin client ဖြင့်
        system တစ်ခုလုံးမှ တွက်ထားပါသည်။
      </p>
    </div>
  );
}
