/**
 * Currency conversion built to an international standard (ISO 4217 codes,
 * per-USD cross-rates) so a live FX feed, a bank, or a crypto price oracle
 * can later feed the same rate table without any call-site changes.
 *
 * Peg: **1 G-Pay = 1 MMK**, fixed. The wallet balance is always MMK; use
 * gpayToCurrency / currencyToGpay to show or accept other currencies.
 */

export const GPAY_PEG_CODE = "MMK" as const;

export interface CurrencyMeta {
  code: string;
  /** Units of this asset per 1 USD. */
  rate_per_usd: number;
  name: string;
  symbol: string;
  kind: "fiat" | "crypto";
  decimals: number;
  flag: string | null;
  updated_at: string;
}

/** Rate lookup keyed by code (units per 1 USD). */
export type RateMap = Map<string, number>;

export function toRateMap(rates: Pick<CurrencyMeta, "code" | "rate_per_usd">[]): RateMap {
  return new Map(rates.map((r) => [r.code, Number(r.rate_per_usd)]));
}

/**
 * Convert `amount` from one currency to another via the USD cross-rate.
 * Returns null when either code is missing from the rate table.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: RateMap,
): number | null {
  const fromRate = rates.get(from);
  const toRate = rates.get(to);
  if (!Number.isFinite(amount) || !fromRate || !toRate) return null;
  // amount(from) → USD → to
  return (amount / fromRate) * toRate;
}

/** G-Pay (MMK-pegged) amount expressed in another currency. */
export function gpayToCurrency(
  gpay: number,
  to: string,
  rates: RateMap,
): number | null {
  return convert(gpay, GPAY_PEG_CODE, to, rates);
}

/** How many G-Pay (= MMK) a given amount of another currency is worth. */
export function currencyToGpay(
  amount: number,
  from: string,
  rates: RateMap,
): number | null {
  return convert(amount, from, GPAY_PEG_CODE, rates);
}

/** Locale/number-aware money formatting with the asset's own precision. */
export function formatMoney(amount: number, meta: CurrencyMeta): string {
  const digits = meta.kind === "crypto" ? Math.min(meta.decimals, 8) : meta.decimals;
  const num = amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  return `${meta.symbol}${num}`;
}

/**
 * Best-guess the viewer's preferred currency from the browser locale's
 * region, falling back to MMK. Client-only.
 */
const REGION_TO_CURRENCY: Record<string, string> = {
  MM: "MMK",
  TH: "THB",
  US: "USD",
  GB: "GBP",
  SG: "SGD",
  CN: "CNY",
  JP: "JPY",
  IN: "INR",
  MY: "MYR",
  KR: "KRW",
  AU: "AUD",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
};

export function detectCurrency(available: string[]): string {
  if (typeof navigator === "undefined") return "MMK";
  try {
    const locale = navigator.language || "en-US";
    const region =
      new Intl.Locale(locale).maximize().region ??
      locale.split("-")[1]?.toUpperCase();
    const guess = region ? REGION_TO_CURRENCY[region] : undefined;
    if (guess && available.includes(guess)) return guess;
  } catch {
    /* ignore */
  }
  return available.includes("MMK") ? "MMK" : (available[0] ?? "USD");
}
