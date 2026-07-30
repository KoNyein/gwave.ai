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
import { SearchBar } from "@/components/ui/search-bar";
import type { SearchOverview } from "@/lib/db/search-admin";

/**
 * What users are searching for. Two questions matter here: which keywords are
 * popular, and which ones came back EMPTY — the second list is the content the
 * app is missing, so it gets equal billing rather than being buried.
 */
export function SearchAnalytics({ overview }: { overview: SearchOverview }) {
  const [filter, setFilter] = React.useState("");

  const needle = filter.trim().toLowerCase();
  const top = needle
    ? overview.top.filter((k) => k.q.includes(needle))
    : overview.top;
  const zero = needle
    ? overview.zeroResults.filter((k) => k.q.includes(needle))
    : overview.zeroResults;

  const cards = [
    { label: "စုစုပေါင်း ရှာဖွေမှု (၃၀ရက်)", value: overview.total },
    { label: "မတူသော keyword", value: overview.unique },
    { label: "ရှာဖွေသူ user", value: overview.searchers },
    { label: "ရလဒ်မရှိ", value: overview.zeroTotal },
    { label: "ယနေ့", value: overview.today },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold tabular-nums">
                {c.value.toLocaleString("en-US")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            ရှာဖွေမှု — ၃၀ ရက် (တစ်ရက်ချင်း)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.byDay}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
              <XAxis
                dataKey="day"
                fontSize={11}
                tickFormatter={(v: string) => v.slice(5)}
                minTickGap={16}
              />
              <YAxis fontSize={11} width={36} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              အများဆုံး ရှာဖွေသော keyword (top 20)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.top.slice(0, 20)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="q"
                  fontSize={10}
                  width={120}
                />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {overview.top.slice(0, 20).map((k) => (
                    <Cell
                      key={k.q}
                      // A keyword that never returns anything is red: it is a
                      // gap, not a success.
                      fill={k.zero === k.count ? "#dc2626" : "#7c3aed"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ရှာဖွေရာ ဘယ်ကနေလဲ (source)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.bySource} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  fontSize={11}
                  width={100}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#0891b2" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <SearchBar
        value={filter}
        onValueChange={setFilter}
        placeholder="Keyword ရှာရန်…"
        containerClassName="max-w-sm"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <KeywordTable
          title={`Keyword အားလုံး (${top.length})`}
          rows={top}
          emptyText="မှတ်တမ်း မရှိသေးပါ — user တစ်ဦး ရှာဖွေပြီးသည်နှင့် ပေါ်လာမည်။ (db/sql/search-queries.sql ကို RDS တွင် run ထားရန် လိုသည်။)"
        />
        <KeywordTable
          title={`⚠ ရလဒ် မရှိသော keyword (${zero.length})`}
          rows={zero}
          highlight
          emptyText="ရလဒ်မရှိသော ရှာဖွေမှု မရှိပါ — ကောင်းသည်။"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            နောက်ဆုံး ရှာဖွေမှုများ (ဘယ်သူ ဘာရှာလဲ)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overview.recent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">မရှိသေးပါ။</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left">Keyword</th>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-right">ရလဒ်</th>
                    <th className="px-3 py-2 text-left">အချိန်</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent.map((r, i) => (
                    <tr key={`${r.at}-${i}`} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{r.q}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {r.fullName || (r.username ? `@${r.username}` : "—")}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {r.source}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right tabular-nums ${
                          r.resultCount === 0 ? "font-bold text-red-600" : ""
                        }`}
                      >
                        {r.resultCount}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {new Date(r.at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        ရှာဖွေသည့် စာလုံးများကိုသာ မှတ်တမ်းတင်ပါသည် (စာမျက်နှာ အကြောင်းအရာ
        မမှတ်ပါ)။ အနီရောင် keyword များသည် ရလဒ် လုံးဝမရသော ရှာဖွေမှုများ —
        user တွေ လိုချင်ပေမယ့် Gwave မှာ မရှိသေးတဲ့ အကြောင်းအရာများ ဖြစ်သည်။
      </p>
    </div>
  );
}

function KeywordTable({
  title,
  rows,
  emptyText,
  highlight = false,
}: {
  title: string;
  rows: { q: string; count: number; zero: number; lastAt: string }[];
  emptyText: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-red-300" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-2 text-left">Keyword</th>
                  <th className="px-3 py-2 text-right">ရှာဖွေ</th>
                  <th className="px-3 py-2 text-right">ရလဒ်မရှိ</th>
                  <th className="px-3 py-2 text-left">နောက်ဆုံး</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.q} className="border-t">
                    <td className="px-3 py-1.5 font-medium">{k.q}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {k.count}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        k.zero > 0 ? "text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {k.zero}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {new Date(k.lastAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
