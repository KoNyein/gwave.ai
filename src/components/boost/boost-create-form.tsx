"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";

import { createBoost } from "@/lib/actions/boosts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BoostableTargets } from "@/lib/db/boosts";
import type { BoostTarget } from "@/types/database";

const TARGET_LABELS: Record<BoostTarget, string> = {
  post: "📝 Post",
  shop_product: "🛍️ Shop ပစ္စည်း",
  pos_product: "🏪 POS ပစ္စည်း",
};

function mmk(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} Ks`;
}

export function BoostCreateForm({
  targets,
  balance,
  prefill,
}: {
  targets: BoostableTargets;
  balance: number;
  prefill: { type: BoostTarget | null; id: string | null };
}) {
  const router = useRouter();

  const optionsFor = (t: BoostTarget) =>
    t === "post"
      ? targets.posts
      : t === "shop_product"
        ? targets.shopProducts
        : targets.posProducts;

  // Pick a sensible initial target type: the prefill, else the first type that
  // actually has something to promote.
  const initialType: BoostTarget =
    prefill.type && optionsFor(prefill.type).length
      ? prefill.type
      : (["post", "shop_product", "pos_product"] as BoostTarget[]).find(
          (t) => optionsFor(t).length,
        ) ?? "post";

  const [type, setType] = React.useState<BoostTarget>(initialType);
  const [targetId, setTargetId] = React.useState<string>(
    prefill.id ?? optionsFor(initialType)[0]?.id ?? "",
  );
  const [headline, setHeadline] = React.useState("");
  const [budget, setBudget] = React.useState(1000);
  const [days, setDays] = React.useState(7);
  const [bid, setBid] = React.useState(50);
  // Targeting — who/where the ad is shown to.
  const [region, setRegion] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [adultOnly, setAdultOnly] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const options = optionsFor(type);
  // A gentle default daily cap: spread the budget across the flight, min 50.
  const dailyCap = Math.max(50, Math.round(budget / Math.max(days, 1)));
  const estViews = bid > 0 ? Math.floor(budget / bid) : 0;
  const enoughFunds = balance >= budget;
  const hasTarget = Boolean(targetId);

  function onTypeChange(next: BoostTarget) {
    setType(next);
    setTargetId(optionsFor(next)[0]?.id ?? "");
  }

  async function submit() {
    if (busy) return;
    setError(null);
    if (!hasTarget) {
      setError("ကြော်ငြာမယ့် အရာ ရွေးပါ။");
      return;
    }
    if (!enoughFunds) {
      setError("G-Pay လက်ကျန် မလုံလောက်ပါ။");
      return;
    }
    setBusy(true);
    const tags = tagsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    const res = await createBoost({
      target_type: type,
      target_id: targetId,
      headline: headline.trim() || null,
      budget_mmk: budget,
      daily_cap_mmk: Math.min(dailyCap, budget),
      bid_mmk: bid,
      days,
      audience: {
        adult: adultOnly || undefined,
        region: region.trim() || undefined,
        tags: tags.length ? tags : undefined,
      },
    });
    setBusy(false);
    if (res.ok) {
      router.push("/boost");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Rocket className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">ကြော်ငြာ အသစ် ဖန်တီးရန်</h2>
      </div>

      {/* Target type */}
      <div className="space-y-1.5">
        <Label>ဘာကို ကြော်ငြာမလဲ</Label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TARGET_LABELS) as BoostTarget[]).map((t) => {
            const count = optionsFor(t).length;
            return (
              <button
                key={t}
                type="button"
                disabled={count === 0}
                onClick={() => onTypeChange(t)}
                className={
                  "rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40 " +
                  (type === t
                    ? "border-primary bg-primary/10"
                    : "text-muted-foreground")
                }
              >
                {TARGET_LABELS[t]}{" "}
                <span className="text-xs text-muted-foreground">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target picker */}
      <div className="space-y-1.5">
        <Label htmlFor="boost-target">ရွေးချယ်ရန်</Label>
        {options.length ? (
          <select
            id="boost-target"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-muted-foreground">
            ဒီအမျိုးအစားမှာ ကြော်ငြာနိုင်တဲ့ အရာ မရှိသေးပါ။
          </p>
        )}
      </div>

      {/* Headline */}
      <div className="space-y-1.5">
        <Label htmlFor="boost-headline">ခေါင်းစဉ် (ရွေးချယ်နိုင်)</Label>
        <Input
          id="boost-headline"
          value={headline}
          maxLength={160}
          placeholder="ဥပမာ — ရာသီအလိုက် လျှော့စျေး"
          onChange={(e) => setHeadline(e.target.value)}
        />
      </div>

      {/* Targeting — location + interests + audience */}
      <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="text-sm font-semibold">🎯 ပစ်မှတ် (ဘယ်သူ့ကို ပြမလဲ)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="boost-region">📍 တည်နေရာ (တိုင်း/မြို့)</Label>
            <Input
              id="boost-region"
              value={region}
              maxLength={80}
              placeholder="ဥပမာ — ရန်ကုန် (အားလုံးဆိုရင် ကွက်လပ်ထား)"
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="boost-tags">💡 စိတ်ဝင်စားမှု (interest)</Label>
            <Input
              id="boost-tags"
              value={tagsInput}
              placeholder="comma ခြား — ဥပမာ: စိုက်ပျိုးရေး, နည်းပညာ"
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={adultOnly}
            onChange={(e) => setAdultOnly(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          အသက် ၁၈ နှစ်ပြည့် (adult) ကိုသာ ပြရန်
        </label>
        <p className="text-[11px] text-muted-foreground">
          တည်နေရာ/စိတ်ဝင်စားမှု ရွေးထားရင် သက်ဆိုင်ရာ ပရိသတ်ကိုသာ ဦးစားပေး ပြပါမည်။
        </p>
      </div>

      {/* Budget / days / bid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="boost-budget">ဘတ်ဂျက် (Ks)</Label>
          <Input
            id="boost-budget"
            type="number"
            min={100}
            step={100}
            value={budget}
            onChange={(e) => setBudget(Math.max(100, Number(e.target.value) || 0))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="boost-days">ကြာချိန် (ရက်)</Label>
          <Input
            id="boost-days"
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) =>
              setDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="boost-bid">တစ်ကြည့် တန်ဖိုး (Ks)</Label>
          <Input
            id="boost-bid"
            type="number"
            min={1}
            value={bid}
            onChange={(e) => setBid(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-center text-sm">
        <div>
          <p className="text-xs text-muted-foreground">တစ်နေ့ အများဆုံး</p>
          <p className="font-bold">{mmk(Math.min(dailyCap, budget))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">ခန့်မှန်း ကြည့်ရှုမှု</p>
          <p className="font-bold">≈ {estViews.toLocaleString("en-US")}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">G-Pay လက်ကျန်</p>
          <p className={"font-bold " + (enoughFunds ? "" : "text-destructive")}>
            {mmk(balance)}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        ဘတ်ဂျက် {mmk(budget)} ကို G-Pay မှ ကြိုတင် သိမ်းထားပါမည်။ သုံးမကုန်သေးသော
        ပမာဏကို မည်သည့်အချိန်မဆို ပယ်ဖျက်၍ ပြန်ထုတ်နိုင်ပါသည်။
      </p>

      {error ? <p className="text-sm text-destructive">❌ {error}</p> : null}

      <Button onClick={submit} disabled={busy || !hasTarget} className="w-full">
        {busy ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" /> ဖန်တီးနေသည်…
          </>
        ) : (
          <>
            <Rocket className="mr-1 h-4 w-4" /> {mmk(budget)} ဖြင့် စတင်ရန်
          </>
        )}
      </Button>
    </div>
  );
}
