"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, Sparkles, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { updateCurrencyRate } from "@/lib/actions/tools";
import {
  convert,
  currencyToGpay,
  detectCurrency,
  formatMoney,
  toRateMap,
  type CurrencyMeta,
} from "@/lib/currency";
import { timeAgo } from "@/lib/format";

export function CurrencyConverter({
  currencies,
  isAdmin,
}: {
  currencies: CurrencyMeta[];
  isAdmin: boolean;
}) {
  const t = useTranslations("tools.currency");
  const codes = currencies.map((c) => c.code);
  const metaMap = new Map(currencies.map((c) => [c.code, c]));
  const rateMap = toRateMap(currencies);

  const [amount, setAmount] = usePersistentState("tool.currency.amount", "1000");
  const [from, setFrom] = usePersistentState("tool.currency.from", "MMK");
  const [to, setTo] = usePersistentState("tool.currency.to", "USD");

  // Auto-detect the viewer's currency on first load (only if they haven't
  // already chosen a "from" this session).
  const detectedRef = React.useRef(false);
  React.useEffect(() => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    const saved = localStorage.getItem("tool.currency.from");
    if (!saved) {
      const guess = detectCurrency(codes);
      if (guess) setFrom(guess);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const input = Number.parseFloat(amount);
  const result = convert(input, from, to, rateMap);
  const gpayEquiv = currencyToGpay(input, from, rateMap);
  const toMeta = metaMap.get(to);

  const fiat = currencies.filter((c) => c.kind === "fiat");
  const crypto = currencies.filter((c) => c.kind === "crypto");

  const Select = ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    label: string;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      aria-label={label}
    >
      <optgroup label="💵 Fiat">
        {fiat.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag ? `${c.flag} ` : ""}
            {c.code} — {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="🪙 Crypto">
        {crypto.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.name}
          </option>
        ))}
      </optgroup>
    </select>
  );

  return (
    <div className="space-y-5">
      {/* Peg banner */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <Wallet className="h-4 w-4 shrink-0 text-primary" />
        <span>
          <b>1 G-Pay = 1 MMK</b> — အမြဲ ချိတ်ဆက်ထားသည် (pegged)
        </span>
      </div>

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
          <Select value={from} onChange={setFrom} label={t("from")} />
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
            {result !== null && toMeta ? formatMoney(result, toMeta) : "–"}
          </div>
          <Select value={to} onChange={setTo} label={t("to")} />
        </div>
      </div>

      {/* G-Pay equivalent */}
      {gpayEquiv !== null ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          = <b>{Math.round(gpayEquiv).toLocaleString("en-US")} G-Pay</b>
          <span className="text-muted-foreground">
            ({from} → wallet)
          </span>
        </div>
      ) : null}

      {/* Rate table */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {t("rateTable")}
        </p>
        <div className="divide-y rounded-lg border">
          {currencies.map((c) => (
            <RateRow key={c.code} meta={c} isAdmin={isAdmin} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RateRow({ meta, isAdmin }: { meta: CurrencyMeta; isAdmin: boolean }) {
  const t = useTranslations("tools.currency");
  const router = useRouter();
  const [value, setValue] = React.useState(String(meta.rate_per_usd));
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const editable = isAdmin && meta.code !== "USD";

  function save() {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t("invalidRate"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateCurrencyRate({
        code: meta.code,
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
        <span className="font-semibold">
          {meta.flag ? `${meta.flag} ` : ""}
          {meta.code}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          {meta.name}
          {meta.kind === "crypto" ? " · crypto" : ""} · {t("perUsd")} ·{" "}
          {t("updated")} {timeAgo(meta.updated_at)}
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
            disabled={pending || Number(value) === Number(meta.rate_per_usd)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
          </Button>
        </div>
      ) : (
        <span className="font-medium">
          {Number(meta.rate_per_usd).toLocaleString()}
        </span>
      )}
    </div>
  );
}
