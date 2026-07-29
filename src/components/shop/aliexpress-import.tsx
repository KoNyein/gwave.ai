"use client";

import * as React from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ImportResult {
  imported?: number;
  updated?: number;
  skipped?: number;
  refreshed?: number;
  currency?: string;
  error?: string;
}

type Kind = "dropship" | "affiliate";

/**
 * Admin-only panel for pulling AliExpress best sellers into the catalogue and
 * for re-pricing what's already there.
 *
 * `kind` is the choice that matters, so it comes first: a dropship listing is
 * bought inside Gwave and we fulfil it from AliExpress; an affiliate listing
 * sends the buyer to AliExpress to pay there. Nothing can make an affiliate
 * purchase happen in-app — we never take the money, so we cannot take the
 * order.
 *
 * The refresh button is not an afterthought either: a copied price drifts from
 * the day it's imported, which is how a listing came to advertise 13 THB for
 * an item selling at 89. Run it on a schedule.
 */
export function AliexpressImport() {
  const [busy, setBusy] = React.useState<"import" | "refresh" | null>(null);
  const [kind, setKind] = React.useState<Kind>("dropship");
  const [markup, setMarkup] = React.useState("25");
  const [limit, setLimit] = React.useState("30");
  const [keywords, setKeywords] = React.useState("");
  const [result, setResult] = React.useState<ImportResult | null>(null);

  // Clamped here so a slip in the box can't ship a silly price; the route
  // clamps again, because a client is never the authority on this.
  const markupPercent = Math.min(Math.max(Number(markup) || 0, 0), 500);

  async function run(action: "import" | "refresh") {
    setBusy(action);
    setResult(null);
    try {
      const response = await fetch("/api/shop/aliexpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "refresh"
            ? { action, markupPercent }
            : {
                action,
                kind,
                markupPercent,
                limit: Math.min(Math.max(Number(limit) || 30, 1), 50),
                ...(keywords.trim() ? { keywords: keywords.trim() } : {}),
              },
        ),
      });
      const body = (await response.json()) as ImportResult;
      setResult(body);
      // A successful write changes the grid behind this panel.
      if (response.ok && !body.error) window.location.reload();
    } catch (error) {
      setResult({ error: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">AliExpress — ရောင်းအားအကောင်းဆုံး</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["dropship", "affiliate"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                kind === option
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "dropship"
                ? "Gwave ထဲမှာ ဝယ် (dropship)"
                : "AliExpress သို့ ပို့ (affiliate)"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            inputMode="numeric"
            className="w-20"
            aria-label="အရေအတွက်"
          />
          <div className="flex items-center gap-1">
            <Input
              value={markup}
              onChange={(event) => setMarkup(event.target.value)}
              inputMode="numeric"
              className="w-20"
              disabled={kind === "affiliate"}
              aria-label="အမြတ် ရာခိုင်နှုန်း"
            />
            <span className="text-xs text-muted-foreground">% အမြတ်</span>
          </div>
          <Input
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="အမျိုးအစား (ရွေးချယ်) — earbuds, watch…"
            className="min-w-40 flex-1"
            maxLength={120}
          />
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => run("import")}
            className="gap-1.5"
          >
            {busy === "import" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            သွင်းမည်
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => run("refresh")}
            className="gap-1.5"
          >
            {busy === "refresh" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            ဈေးအသစ်ယူ
          </Button>
        </div>

        {result?.error && (
          <p className="text-sm text-destructive">{result.error}</p>
        )}
        {result && !result.error && (
          <p className="text-sm text-muted-foreground">
            {result.refreshed !== undefined
              ? `ဈေးအသစ် ${result.refreshed} ခု ပြင်ပြီး။`
              : `အသစ် ${result.imported ?? 0} ခု · ဈေးပြင် ${result.updated ?? 0} ခု` +
                (result.skipped ? ` · ဈေးမရလို့ ကျော် ${result.skipped} ခု` : "")}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {kind === "dropship"
            ? "Dropship — ဝယ်သူက Gwave ထဲမှာပဲ အော်ဒါတင်ပြီး ပစ္စည်းရောက်မှ " +
              "ငွေချေပါသည်။ အော်ဒါဝင်လာလျှင် သင်က AliExpress တွင် မှာယူပြီး " +
              "ပို့ပေးရပါမည်။ ဈေးမှာ AliExpress ဈေးအပေါ် အမြတ် % ပေါင်းထားသည်။"
            : "Affiliate — ဝယ်သူသည် AliExpress သို့ ရောက်သွားပြီး ထိုနေရာတွင် " +
              "ငွေချေပါသည်။ ကျွန်ုပ်တို့က ကော်မရှင်သာ ရသဖြင့် app ထဲတွင် " +
              "အရောင်းလုပ်ငန်း မပြီးနိုင်ပါ။ အမြတ် % လည်း မသက်ဆိုင်ပါ။"}
        </p>
        <p className="text-xs text-muted-foreground">
          ဈေးနှုန်းများကို သွင်းသည့်အချိန်တွင် AliExpress မှ တိုက်ရိုက် ယူပါသည်။
          ရောင်းသူဘက်တွင် ဈေးပြောင်းသွားနိုင်သဖြင့် “ဈေးအသစ်ယူ” ကို ပုံမှန်
          နှိပ်ပေးပါ။
        </p>
      </CardContent>
    </Card>
  );
}
