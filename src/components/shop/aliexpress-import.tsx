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

/**
 * Admin-only panel for pulling AliExpress best sellers into the catalogue and
 * for re-pricing what's already there.
 *
 * The refresh button is not an afterthought: an affiliate price belongs to the
 * merchant and drifts from the day it's imported, which is how a listing came
 * to advertise 13 THB for an item selling at 89. Run it on a schedule.
 */
export function AliexpressImport() {
  const [busy, setBusy] = React.useState<"import" | "refresh" | null>(null);
  const [limit, setLimit] = React.useState("30");
  const [keywords, setKeywords] = React.useState("");
  const [result, setResult] = React.useState<ImportResult | null>(null);

  async function run(action: "import" | "refresh") {
    setBusy(action);
    setResult(null);
    try {
      const response = await fetch("/api/shop/aliexpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "refresh"
            ? { action }
            : {
                action,
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
          <Input
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            inputMode="numeric"
            className="w-20"
            aria-label="အရေအတွက်"
          />
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
          ဈေးနှုန်းများကို သွင်းသည့်အချိန်တွင် AliExpress မှ တိုက်ရိုက် ယူပါသည်။
          ရောင်းသူဘက်တွင် ဈေးပြောင်းသွားနိုင်သဖြင့် “ဈေးအသစ်ယူ” ကို ပုံမှန်
          နှိပ်ပေးပါ။
        </p>
      </CardContent>
    </Card>
  );
}
