import "server-only";

import { createAnonClient } from "@/lib/data/anon";
import type { CurrencyMeta } from "@/lib/currency";

/**
 * All active currencies (fiat + crypto) with metadata, fiat first then
 * crypto, each group ordered by code. Publicly readable, so the cookie-less
 * anon client works anywhere (including the tools hub for logged-out users).
 */
export async function getActiveCurrencies(): Promise<CurrencyMeta[]> {
  const db = createAnonClient();
  const { data } = await db
    .from("currency_rates")
    .select("code, rate_per_usd, name, symbol, kind, decimals, flag, updated_at")
    .eq("is_active", true)
    .order("kind", { ascending: true })
    .order("code", { ascending: true });

  return (data ?? []).map((r) => ({
    code: r.code,
    rate_per_usd: Number(r.rate_per_usd),
    name: r.name ?? r.code,
    symbol: r.symbol ?? r.code,
    kind: (r.kind as "fiat" | "crypto") ?? "fiat",
    decimals: r.decimals ?? 2,
    flag: r.flag,
    updated_at: r.updated_at,
  }));
}
