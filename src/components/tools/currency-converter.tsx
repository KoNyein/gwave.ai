"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { updateCurrencyRate } from "@/lib/actions/tools";
import { timeAgo } from "@/lib/format";
import type { CurrencyRate } from "@/types/database";

export function CurrencyConverter({
  rates,
  isAdmin,
}: {
  rates: CurrencyRate[];
  isAdmin: boolean;
}) {
  const t = useTranslations("tools.currency");
  const [amount, setAmount] = usePersistentState("tool.currency.amount", "100");
  const [from, setFrom] = usePersistentState("tool.currency.from", "USD");
  const [to, setTo] = usePersistentState("tool.currency.to", "THB");

  const rateMap = new Map(rates.map((rate) => [rate.code, Number(rate.rate_per_usd)]));
  const input = Number.parseFloat(amount);
  const fromRate = rateMap.get(from);
  const toRate = rateMap.get(to);
  const result =
    Number.isFinite(input) && fromRate && toRate
      ? (input / fromRate) * toRate
      : null;

  return (
    <div className="space-y-5">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="currency-amount">{t("amount")}</Label>
          <Input
            id="currency-amount"
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <select
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            aria-label={t("from")}
          >
            {rates.map((rate) => (
              <option key={rate.code}>{rate.code}</option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mb-10 hidden rounded-full sm:inline-flex"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          aria-label={t("swap")}
        >
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
        <div className="space-y-1.5">
          <Label>{t("converted")}</Label>
          <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-semibold">
            {result !== null
              ? result.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : "–"}
          </div>
          <select
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            aria-label={t("to")}
          >
            {rates.map((rate) => (
              <option key={rate.code}>{rate.code}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rate table */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {t("rateTable")}
        </p>
        <div className="divide-y rounded-lg border">
          {rates.map((rate) => (
            <RateRow key={rate.code} rate={rate} isAdmin={isAdmin} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RateRow({
  rate,
  isAdmin,
}: {
  rate: CurrencyRate;
  isAdmin: boolean;
}) {
  const t = useTranslations("tools.currency");
  const router = useRouter();
  const [value, setValue] = React.useState(String(rate.rate_per_usd));
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const editable = isAdmin && rate.code !== "USD";

  function save() {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t("invalidRate"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateCurrencyRate({
        code: rate.code as "USD" | "THB" | "MMK",
        ratePerUsd: parsed,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 text-sm">
      <div>
        <span className="font-semibold">{rate.code}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {t("perUsd")} · {t("updated")} {timeAgo(rate.updated_at)}
        </span>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      {editable ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="any"
            min="0"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-8 w-28"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={save}
            disabled={pending || Number(value) === Number(rate.rate_per_usd)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
          </Button>
        </div>
      ) : (
        <span className="font-medium">
          {Number(rate.rate_per_usd).toLocaleString()}
        </span>
      )}
    </div>
  );
}
