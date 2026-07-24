"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Buy a single track or start an all-access subscription from the G-Pay wallet.
 * On success it refreshes the server component so the player unlocks. Friendly,
 * plain-language errors (WCAG understandable) — including a wallet top-up hint
 * when the balance is short.
 */
export function AudioPurchase({
  trackId,
  price,
  currency,
}: {
  trackId: string;
  price: number | null;
  currency: string | null;
}) {
  const t = useTranslations("audio");
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | "buy" | "sub">(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [lowBalance, setLowBalance] = React.useState(false);

  async function run(kind: "buy" | "sub") {
    setBusy(kind);
    setErr(null);
    setLowBalance(false);
    try {
      const res = await fetch(
        kind === "buy" ? `/api/audio/${trackId}/purchase` : "/api/audio/subscribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: kind === "sub" ? JSON.stringify({ plan: "audio_monthly" }) : undefined,
        },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        router.refresh();
        return;
      }
      const msg = j.error ?? "error";
      if (/insufficient|balance/i.test(msg)) setLowBalance(true);
      setErr(msg);
    } catch {
      setErr("network");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {price && price > 0 ? (
          <Button onClick={() => run("buy")} disabled={busy !== null}>
            {busy === "buy" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-1 h-4 w-4" />
            )}
            {t("buyFor", { price: `${currency ?? ""} ${price}`.trim() })}
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => run("sub")} disabled={busy !== null}>
          {busy === "sub" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="mr-1 h-4 w-4" />
          )}
          {t("subscribe")}
        </Button>
      </div>
      {err && (
        <p className="text-xs text-red-500">
          {lowBalance ? t("needWallet") : t("purchaseFail", { msg: err })}
          {lowBalance && (
            <>
              {" "}
              <a href="/gpay" className="font-medium underline">
                {t("topUp")}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
