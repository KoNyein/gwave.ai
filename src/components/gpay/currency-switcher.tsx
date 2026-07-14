"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import {
  type CurrencyMeta,
  formatMoney,
  gpayToCurrency,
  toRateMap,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "gw:display-currency";

/**
 * Lets the viewer pick which currency their G-Pay balance is shown in. G-Pay
 * is USD-pegged internally; this only changes the *display*, converting via the
 * live rate table. The choice persists per-browser.
 */
export function useDisplayCurrency(currencies: CurrencyMeta[]) {
  const [code, setCode] = React.useState("USD");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && currencies.some((c) => c.code === saved)) setCode(saved);
    } catch {
      /* private mode — keep USD */
    }
  }, [currencies]);

  const choose = React.useCallback((next: string) => {
    setCode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const rates = React.useMemo(() => toRateMap(currencies), [currencies]);
  const meta = React.useMemo(
    () => currencies.find((c) => c.code === code) ?? currencies[0] ?? null,
    [currencies, code],
  );

  /** Format a G-Pay (USD) amount in the chosen display currency. */
  const format = React.useCallback(
    (gpayAmount: number): string => {
      if (!meta) return gpayAmount.toFixed(2);
      const converted = gpayToCurrency(gpayAmount, meta.code, rates);
      if (converted == null) return gpayAmount.toFixed(2);
      return formatMoney(converted, meta);
    },
    [meta, rates],
  );

  return { code, choose, meta, format };
}

/** Compact currency selector (native <select> styled as a chip). */
export function CurrencySwitcher({
  currencies,
  value,
  onChange,
  className,
}: {
  currencies: CurrencyMeta[];
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full bg-black/15 px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {value}
      <ChevronDown className="h-3 w-3 opacity-80" />
      <select
        aria-label="Display currency"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {currencies.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag ? `${c.flag} ` : ""}
            {c.code} — {c.name}
          </option>
        ))}
      </select>
    </span>
  );
}
