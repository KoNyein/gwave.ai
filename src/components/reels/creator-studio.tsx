"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, Eye, Heart, Loader2, Video } from "lucide-react";

import { withdrawEarnings } from "@/lib/actions/reels";
import { Button } from "@/components/ui/button";
import type { CreatorSummary } from "@/types/database";

function mmk(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} Ks`;
}

export function CreatorStudio({ summary }: { summary: CreatorSummary }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const withdraw = async () => {
    if (busy || summary.balance <= 0) return;
    setBusy(true);
    setMsg(null);
    const res = await withdrawEarnings();
    if (res.ok) {
      setMsg(`✅ ${mmk(res.data)} ကို G-Pay သို့ လွှဲပြီးပါပြီ။`);
      router.refresh();
    } else {
      setMsg(
        res.error.includes("G-Pay")
          ? "💳 G-Pay account (active) လိုအပ်ပါတယ် — /gpay မှာ ဖွင့်ပါ။"
          : `❌ ${res.error}`,
      );
    }
    setBusy(false);
  };

  const stats: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Video className="h-4 w-4" />, label: "Reels", value: String(summary.reelCount) },
    { icon: <Eye className="h-4 w-4" />, label: "ကြည့်ရှုမှု", value: summary.totalViews.toLocaleString("en-US") },
    { icon: <Heart className="h-4 w-4" />, label: "Like", value: summary.totalLikes.toLocaleString("en-US") },
    { icon: <Banknote className="h-4 w-4" />, label: "စုစုပေါင်း ဝင်ငွေ", value: mmk(summary.totalEarned) },
  ];

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-emerald-600" />
        <h2 className="font-semibold">🎬 Creator Studio — ဝင်ငွေ</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/60 p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              {s.icon}
              <span className="text-[11px]">{s.label}</span>
            </div>
            <p className="text-lg font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <div>
          <p className="text-xs text-muted-foreground">ထုတ်ယူနိုင်သော လက်ကျန်</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {mmk(summary.balance)}
          </p>
        </div>
        <Button onClick={withdraw} disabled={busy || summary.balance <= 0} size="sm">
          {busy ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> လွှဲနေသည်…
            </>
          ) : (
            "G-Pay သို့ ထုတ်ယူ"
          )}
        </Button>
      </div>

      {msg ? <p className="text-sm">{msg}</p> : null}
      <p className="text-xs text-muted-foreground">
        💡 ဝင်ငွေနှုန်း — ကြည့်ရှုမှု တစ်ခုလျှင် ၁ Ks၊ Like တစ်ခုလျှင် ၃ Ks (play-money)။
      </p>
    </div>
  );
}
