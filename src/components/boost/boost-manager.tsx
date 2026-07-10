"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Eye,
  Loader2,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  Rocket,
  X,
} from "lucide-react";

import {
  cancelBoost,
  fetchBoostDailyStats,
  setBoostStatus,
} from "@/lib/actions/boosts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  BoostDailyStat,
  BoostStatus,
  BoostTarget,
} from "@/types/database";

interface ManagerBoost {
  id: string;
  target_type: BoostTarget;
  headline: string | null;
  budget_mmk: number;
  spent_mmk: number;
  daily_cap_mmk: number;
  bid_mmk: number;
  status: BoostStatus;
  impressions: number;
  reach: number;
  clicks: number;
  end_at: string;
  preview: { title: string; image: string | null };
}

function mmk(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} Ks`;
}

const STATUS_STYLE: Record<BoostStatus, { label: string; cls: string }> = {
  active: { label: "▶ လည်ပတ်နေသည်", cls: "bg-emerald-500/15 text-emerald-600" },
  paused: { label: "⏸ ခဏရပ်", cls: "bg-amber-500/15 text-amber-600" },
  completed: { label: "✓ ပြီးဆုံး", cls: "bg-blue-500/15 text-blue-600" },
  cancelled: { label: "✕ ပယ်ဖျက်", cls: "bg-muted text-muted-foreground" },
  rejected: { label: "⚠ ငြင်းပယ်", cls: "bg-destructive/15 text-destructive" },
};

const TARGET_ICON: Record<BoostTarget, string> = {
  post: "📝",
  shop_product: "🛍️",
  pos_product: "🏪",
};

export function BoostManager({ boosts }: { boosts: ManagerBoost[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">ကြော်ငြာ စီမံခန့်ခွဲမှု</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/boost/new">
            <Plus className="mr-1 h-4 w-4" /> အသစ်
          </Link>
        </Button>
      </div>

      {boosts.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          ကြော်ငြာ မရှိသေးပါ။ Post / Shop / POS ပစ္စည်းများကို တွန်းတင်ကြည့်ပါ။
        </div>
      ) : (
        boosts.map((b) => <BoostRow key={b.id} boost={b} />)
      )}
    </div>
  );
}

function BoostRow({ boost }: { boost: ManagerBoost }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [stats, setStats] = React.useState<BoostDailyStat[] | null>(null);
  const st = STATUS_STYLE[boost.status];
  const pct = boost.budget_mmk
    ? Math.min(100, (boost.spent_mmk / boost.budget_mmk) * 100)
    : 0;
  const ctr = boost.impressions
    ? ((boost.clicks / boost.impressions) * 100).toFixed(1)
    : "0.0";
  const canToggle = boost.status === "active" || boost.status === "paused";
  const canCancel = boost.status === "active" || boost.status === "paused";

  async function toggle() {
    setBusy(true);
    await setBoostStatus(boost.id, boost.status === "active" ? "paused" : "active");
    setBusy(false);
    router.refresh();
  }

  async function cancel() {
    if (!window.confirm("ကြော်ငြာ ပယ်ဖျက်မလား? သုံးမကုန်သေးသော ပမာဏ G-Pay သို့ ပြန်ဝင်ပါမည်။"))
      return;
    setBusy(true);
    const res = await cancelBoost(boost.id);
    setBusy(false);
    if (res.ok && res.data > 0) {
      window.alert(`${mmk(res.data)} ကို G-Pay သို့ ပြန်အမ်းပြီးပါပြီ။`);
    }
    router.refresh();
  }

  async function loadStats() {
    setOpen((v) => !v);
    if (stats === null) {
      const data = await fetchBoostDailyStats(boost.id, 30);
      setStats(data);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {TARGET_ICON[boost.target_type]}{" "}
            {boost.headline || boost.preview.title}
          </p>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
              st.cls,
            )}
          >
            {st.label}
          </span>
        </div>
        <div className="flex shrink-0 gap-1">
          {canToggle ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle} disabled={busy}>
              {boost.status === "active" ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={cancel}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Budget progress */}
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>သုံးပြီး {mmk(boost.spent_mmk)}</span>
          <span>ဘတ်ဂျက် {mmk(boost.budget_mmk)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-muted">
          <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-muted/60 p-2">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> ကြည့်ရှုမှု
          </div>
          <p className="font-bold">{boost.impressions.toLocaleString("en-US")}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" /> Click
          </div>
          <p className="font-bold">{boost.clicks.toLocaleString("en-US")}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <p className="text-xs text-muted-foreground">CTR</p>
          <p className="font-bold">{ctr}%</p>
        </div>
      </div>

      <button
        type="button"
        onClick={loadStats}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium hover:bg-muted/50"
      >
        <BarChart3 className="h-3.5 w-3.5" /> နေ့စဉ် စာရင်း {open ? "▲" : "▼"}
      </button>

      {open ? (
        stats === null ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : stats.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">ဒေတာ မရှိသေးပါ။</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[320px] text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-2">နေ့</th>
                  <th className="py-1.5 pr-2 text-right">ကြည့်ရှု</th>
                  <th className="py-1.5 pr-2 text-right">Click</th>
                  <th className="py-1.5 text-right">သုံးငွေ</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.day} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 tabular-nums">{s.day.slice(5)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{s.impressions}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{s.clicks}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{mmk(s.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
