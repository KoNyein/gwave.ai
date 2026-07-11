"use client";

import * as React from "react";
import { ArrowRight, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GpayTxnDetail } from "@/lib/db/gpay";
import type { GpayTxnKind } from "@/types/database";

const KIND_STYLE: Record<GpayTxnKind, { label: string; cls: string }> = {
  transfer: { label: "လွှဲ", cls: "bg-blue-500/10 text-blue-600" },
  topup: { label: "ဖြည့်", cls: "bg-emerald-500/10 text-emerald-600" },
  withdraw: { label: "ထုတ်", cls: "bg-amber-500/10 text-amber-600" },
  fee: { label: "အခ", cls: "bg-muted text-muted-foreground" },
};

function mmk(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} Ks`;
}

function Party({ p }: { p: GpayTxnDetail["from"] }) {
  if (!p) return <span className="text-muted-foreground">— (စနစ်)</span>;
  return (
    <span className="min-w-0">
      <span className="block truncate font-medium">{p.full_name}</span>
      <span className="block text-[11px] text-muted-foreground">{p.phone}</span>
    </span>
  );
}

export function GpayLedger({ transactions }: { transactions: GpayTxnDetail[] }) {
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<GpayTxnKind | "all">("all");

  const q = query.trim().toLowerCase();
  const rows = transactions.filter((t) => {
    if (kind !== "all" && t.kind !== kind) return false;
    if (!q) return true;
    const hay = `${t.from?.full_name ?? ""} ${t.from?.phone ?? ""} ${t.to?.full_name ?? ""} ${t.to?.phone ?? ""} ${t.note ?? ""}`.toLowerCase();
    return hay.includes(q);
  });

  // Summary by kind (across the loaded window).
  const summary = (["transfer", "topup", "withdraw", "fee"] as GpayTxnKind[]).map(
    (k) => {
      const list = transactions.filter((t) => t.kind === k);
      return {
        k,
        count: list.length,
        total: list.reduce((s, t) => s + Number(t.amount), 0),
      };
    },
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.k} className="rounded-xl border bg-card p-3">
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                KIND_STYLE[s.k].cls,
              )}
            >
              {KIND_STYLE[s.k].label}
            </span>
            <p className="mt-1 text-lg font-bold">{mmk(s.total)}</p>
            <p className="text-[11px] text-muted-foreground">{s.count} ကြိမ်</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="အမည် / ဖုန်း / မှတ်ချက် ရှာရန်"
            className="w-64 bg-background pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", "transfer", "topup", "withdraw", "fee"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                kind === k ? "border-primary bg-primary/10" : "text-muted-foreground",
              )}
            >
              {k === "all" ? "အားလုံး" : KIND_STYLE[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3">အချိန်</th>
              <th className="p-3">အမျိုးအစား</th>
              <th className="p-3">ပေးသူ → လက်ခံသူ</th>
              <th className="p-3 text-right">ပမာဏ</th>
              <th className="p-3">မှတ်ချက်</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  မှတ်တမ်း မတွေ့ပါ။
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-b last:border-0 align-top">
                  <td className="whitespace-nowrap p-3 text-xs tabular-nums text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        KIND_STYLE[t.kind].cls,
                      )}
                    >
                      {KIND_STYLE[t.kind].label}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Party p={t.from} />
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <Party p={t.to} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-3 text-right font-semibold tabular-nums">
                    {mmk(Number(t.amount))}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {t.note ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
