import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/metals — world metal prices for the knowledge section.
 *
 * Two sources, deliberately labelled by what they really are:
 *
 *  1. COMEX/CME futures via Yahoo Finance's public chart API (no key):
 *     gold, silver, copper, platinum, palladium, aluminium. These are the
 *     global benchmarks the world actually trades; each carries a 1-month
 *     daily close series for the sparkline. Cached 10 minutes.
 *
 *  2. LME official prices via metals.dev, WHEN `METALS_DEV_API_KEY` is set:
 *     nickel, zinc, tin, lead, LME aluminium/copper, plus rhodium. Cached
 *     8 hours so a free-tier key (100 req/month) is never exhausted. The
 *     LME price IS what Myanmar's mining trade has always called the
 *     "Rotterdam price" — Rotterdam is the LME's main European delivery
 *     point, and the quotes converged decades ago — so the UI says both.
 *
 * What is NOT here, on purpose: live SHFE (Shanghai) and Fastmarkets
 * tungsten/APT quotes. Both are licensed feeds with no free tier; inventing
 * numbers for them would be worse than absence. The response says which
 * sources are live so the UI can show honest placeholders.
 */
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";

interface MetalRow {
  key: string;
  name: string;
  nameMy: string;
  group: "precious" | "base";
  exchange: string;
  /** USD per `unit`. */
  usd: number;
  unit: "toz" | "lb" | "t";
  changePct: number | null;
  spark: number[];
  ts: number;
}

const YAHOO_METALS: {
  symbol: string;
  key: string;
  name: string;
  nameMy: string;
  group: "precious" | "base";
  unit: MetalRow["unit"];
  exchange: string;
}[] = [
  { symbol: "GC=F", key: "gold", name: "Gold", nameMy: "ရွှေ", group: "precious", unit: "toz", exchange: "COMEX" },
  { symbol: "SI=F", key: "silver", name: "Silver", nameMy: "ငွေ", group: "precious", unit: "toz", exchange: "COMEX" },
  { symbol: "PL=F", key: "platinum", name: "Platinum", nameMy: "ပလက်တီနမ်", group: "precious", unit: "toz", exchange: "NYMEX" },
  { symbol: "PA=F", key: "palladium", name: "Palladium", nameMy: "ပလေဒီယမ်", group: "precious", unit: "toz", exchange: "NYMEX" },
  { symbol: "HG=F", key: "copper", name: "Copper", nameMy: "ကြေးနီ", group: "base", unit: "lb", exchange: "COMEX" },
  { symbol: "ALI=F", key: "aluminum", name: "Aluminium", nameMy: "အလူမီနီယမ်", group: "base", unit: "t", exchange: "CME" },
];

/** metals.dev answers in USD per troy oz for everything we ask of it. */
const METALS_DEV_METALS: Omit<MetalRow, "usd" | "changePct" | "spark" | "ts">[] = [
  { key: "rhodium", name: "Rhodium", nameMy: "ရိုဒီယမ်", group: "precious", unit: "toz", exchange: "Spot" },
  { key: "lme_nickel", name: "Nickel", nameMy: "နီကယ်", group: "base", unit: "t", exchange: "LME (Rotterdam)" },
  { key: "lme_zinc", name: "Zinc", nameMy: "သွပ်", group: "base", unit: "t", exchange: "LME (Rotterdam)" },
  { key: "lme_tin", name: "Tin", nameMy: "ခဲဖြူ (ရော်တာဒမ်ဈေး)", group: "base", unit: "t", exchange: "LME (Rotterdam)" },
  { key: "lme_lead", name: "Lead", nameMy: "ခဲ", group: "base", unit: "t", exchange: "LME (Rotterdam)" },
];

let yahooCache: { at: number; rows: MetalRow[] } | null = null;
let lmeCache: { at: number; rows: MetalRow[] } | null = null;
const YAHOO_TTL = 10 * 60_000;
// A free metals.dev key allows 100 requests/month; 8h ≈ 90/month with margin.
const LME_TTL = 8 * 3_600_000;

async function fetchYahoo(): Promise<MetalRow[]> {
  if (yahooCache && Date.now() - yahooCache.at < YAHOO_TTL) {
    return yahooCache.rows;
  }
  const rows = await Promise.all(
    YAHOO_METALS.map(async (m): Promise<MetalRow | null> => {
      try {
        const res = await fetch(
          `${YAHOO}/${encodeURIComponent(m.symbol)}?range=1mo&interval=1d`,
          {
            headers: { "User-Agent": "Mozilla/5.0 (gwave.cc metals board)" },
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as {
          chart?: {
            result?: {
              meta?: {
                regularMarketPrice?: number;
                chartPreviousClose?: number;
                regularMarketTime?: number;
              };
              indicators?: { quote?: { close?: (number | null)[] }[] };
            }[];
          };
        };
        const r = data.chart?.result?.[0];
        const price = r?.meta?.regularMarketPrice;
        if (price == null) return null;
        const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter(
          (c): c is number => c != null,
        );
        const prev = closes.length > 1 ? closes[closes.length - 2] : null;
        return {
          ...m,
          usd: price,
          changePct: prev ? ((price - prev) / prev) * 100 : null,
          spark: closes.slice(-30),
          ts: (r?.meta?.regularMarketTime ?? 0) * 1000 || Date.now(),
        };
      } catch {
        return null;
      }
    }),
  );
  const ok = rows.filter((r): r is MetalRow => r !== null);
  // Keep stale prices over no prices, but never cache an empty answer.
  if (ok.length > 0) yahooCache = { at: Date.now(), rows: ok };
  return ok.length > 0 ? ok : (yahooCache?.rows ?? []);
}

async function fetchMetalsDev(): Promise<MetalRow[]> {
  const key = process.env.METALS_DEV_API_KEY;
  if (!key) return [];
  if (lmeCache && Date.now() - lmeCache.at < LME_TTL) return lmeCache.rows;
  try {
    const res = await fetch(
      `https://api.metals.dev/v1/latest?api_key=${encodeURIComponent(key)}&currency=USD&unit=toz`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`metals.dev ${res.status}`);
    const data = (await res.json()) as {
      metals?: Record<string, number>;
      timestamps?: { metal?: string };
    };
    const prices = data.metals ?? {};
    const ts = data.timestamps?.metal
      ? Date.parse(data.timestamps.metal)
      : Date.now();
    const TOZ_PER_TONNE = 32_150.7;
    const rows: MetalRow[] = [];
    for (const m of METALS_DEV_METALS) {
      const perToz = prices[m.key];
      if (perToz == null || perToz <= 0) continue;
      rows.push({
        ...m,
        // LME base metals are quoted per tonne everywhere; convert from the
        // per-toz figure the API normalised to. Rhodium stays per toz.
        usd: m.unit === "t" ? perToz * TOZ_PER_TONNE : perToz,
        changePct: null,
        spark: [],
        ts,
      });
    }
    if (rows.length > 0) lmeCache = { at: Date.now(), rows };
    return rows;
  } catch {
    return lmeCache?.rows ?? [];
  }
}

export async function GET() {
  const [yahoo, lme] = await Promise.all([fetchYahoo(), fetchMetalsDev()]);
  return NextResponse.json({
    metals: [...yahoo, ...lme],
    sources: {
      comex: yahoo.length > 0,
      lme: lme.length > 0,
      lmeConfigured: Boolean(process.env.METALS_DEV_API_KEY),
    },
  });
}
