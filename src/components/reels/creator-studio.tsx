"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, BarChart3, Clock, Eye, Heart, Loader2, Video } from "lucide-react";

import { withdrawEarnings } from "@/lib/actions/reels";
import { Button } from "@/components/ui/button";
import type { CreatorSummary } from "@/types/database";

function mmk(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} Ks`;
}

/** Total seconds → "Hနာ Mမိ Sစ" (Burmese h/m/s). */
function watchTime(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const parts: string[] = [];
  if (h) parts.push(`${h}နာ`);
  if (m || h) parts.push(`${m}မိ`);
  parts.push(`${s}စ`);
  return parts.join(" ");
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
    { icon: <Clock className="h-4 w-4" />, label: "ကြည့်ချိန်", value: watchTime(summary.totalWatchSeconds) },
    { icon: <Banknote className="h-4 w-4" />, label: "စုစုပေါင်း ဝင်ငွေ", value: mmk(summary.totalEarned) },
  ];

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-emerald-600" />
        <h2 className="font-semibold">🎬 Creator Studio — ဝင်ငွေ</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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

      <Link
        href="/reels/analytics"
        className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium hover:bg-muted/50"
      >
        <BarChart3 className="h-4 w-4" /> 📊 အသေးစိတ် စာရင်း (နေ့စဉ် / လစဉ်)
      </Link>

      <RulesPanel />
    </div>
  );
}

function RulesPanel() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-lg border bg-muted/40 p-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between font-medium"
      >
        <span>📜 ဝင်ငွေ စည်းကမ်းချက် (Monetization rules)</span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          <li>
            <b>ဝင်ငွေနှုန်း</b> — ကြည့်ရှုမှု ၁ ခု = <b>၁ Ks</b>၊ Like ၁ ခု ={" "}
            <b>၃ Ks</b>၊ ကြည့်ချိန် ၁ မိနစ် = <b>၃ Ks</b> (စက္ကန့် ၁ ခု = ၀.၀၅ Ks)။ (play-money MMK)
          </li>
          <li>
            ကြည့်ရှုမှုကို <b>ကြည့်သူ တစ်ဦးလျှင် တစ်ကြိမ်သာ</b> ရေတွက်သည်။
          </li>
          <li>
            ကိုယ့် reel ကို <b>ကိုယ်တိုင် ကြည့်/like</b> လုပ်ခြင်း — ဝင်ငွေ မရပါ။
          </li>
          <li>
            ကြည့်ချိန် ဝင်ငွေကို တစ်ကြိမ်လျှင် အများဆုံး <b>၃၀၀ စက္ကန့်</b> ကန့်သတ်ထားသည် (bot/tab-ဖွင့်ထား လိမ်လည်မှု တားဆီးရန်)။
          </li>
          <li>
            ငွေထုတ်ရန် <b>active G-Pay account</b> လိုအပ်သည်။ ငွေအားလုံး G-Pay wallet သို့ လွှဲပါသည်။
          </li>
          <li>
            <b>မူပိုင်ခွင့် (Copyright)</b> — ဝင်ငွေ ရရှိမည့် video/အသံသည် <b>ကိုယ်တိုင်
            ဖန်တီးထားသော မူရင်း (original)</b> ဖြစ်ရမည်။ အပြည်ပြည်ဆိုင်ရာ မူပိုင်ခွင့်
            (international copyright) ချိုးဖောက်မှု မရှိကြောင်း တိုက်ဆိုင်စစ်ဆေးပြီးမှသာ
            ဝင်ငွေ ပေးပါမည်။
          </li>
          <li>
            အခြား platform / social network (YouTube, TikTok, Facebook, …) မည်သည့်
            နေရာတွင်မျှ <b>တင်ဖူးခြင်း မရှိသေးသော</b> content သာ monetize ဖြစ်သည်။
            တင်စဉ် “မူရင်း content” အတည်ပြုချက် အမှန်ခြစ်မှသာ ဝင်ငွေ တွက်ချက်သည်။
          </li>
          <li>
            လိမ်လည်မှု (fake views/likes) သို့မဟုတ် သူတစ်ပါး/ကူးယူ content တွေ့ရှိပါက
            ဝင်ငွေ ရုပ်သိမ်း/account ပိတ်နိုင်သည်။ တရားဝင်၊ ကိုယ်ပိုင် content သာ တင်ပါ။
          </li>
        </ul>
      ) : null}
    </div>
  );
}
