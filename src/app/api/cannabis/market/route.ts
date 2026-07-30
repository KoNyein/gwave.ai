import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Cannabis / hemp / CBD market data — EDUCATIONAL ONLY.
 *
 * There is no exchange that trades "cannabis" as a commodity, and the
 * wholesale benchmarks that do exist (Hemp Benchmarks™, PanXchange) are
 * licensed feeds. What IS public is the listed-equity market: cannabis
 * ETFs and the major producers/retailers/CBD companies on NYSE, NASDAQ,
 * TSX and OTC. Those quotes come from the same Yahoo v8 chart API the
 * metals board uses — free, no key, 1-month sparkline included.
 *
 * The page that renders this is 18+ (requireAdult) and carries a
 * not-investment-advice / illegal-in-Myanmar disclaimer. This route only
 * serves public stock quotes.
 */
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";

type Category = "etf" | "producer" | "us_retail" | "cbd_hemp";

interface Row {
  symbol: string;
  key: string;
  name: string;
  category: Category;
  exchange: string;
  note: string; // one-line what-this-is, English (UI translates around it)
  usd: number;
  changePct: number | null;
  spark: number[];
  ts: number;
}

const SYMBOLS: Omit<Row, "usd" | "changePct" | "spark" | "ts">[] = [
  // Sector ETFs — the closest thing to a "cannabis market index".
  { symbol: "MSOS", key: "msos", name: "AdvisorShares Pure US Cannabis ETF", category: "etf", exchange: "NYSE Arca", note: "US multi-state operators index" },
  { symbol: "MJ", key: "mj", name: "Amplify Alternative Harvest ETF", category: "etf", exchange: "NYSE Arca", note: "Global cannabis index" },
  { symbol: "YOLO", key: "yolo", name: "AdvisorShares Pure Cannabis ETF", category: "etf", exchange: "NYSE Arca", note: "Global cannabis, actively managed" },
  // Licensed producers (Canada, world's first federal legal market).
  { symbol: "TLRY", key: "tlry", name: "Tilray Brands", category: "producer", exchange: "NASDAQ", note: "Largest Canadian producer" },
  { symbol: "CGC", key: "cgc", name: "Canopy Growth", category: "producer", exchange: "NASDAQ", note: "Canadian producer" },
  { symbol: "CRON", key: "cron", name: "Cronos Group", category: "producer", exchange: "NASDAQ", note: "Canadian producer" },
  { symbol: "ACB", key: "acb", name: "Aurora Cannabis", category: "producer", exchange: "NASDAQ", note: "Canadian medical-focus producer" },
  { symbol: "OGI", key: "ogi", name: "Organigram", category: "producer", exchange: "NASDAQ", note: "Canadian producer" },
  // US multi-state retailers (OTC because of US federal law).
  { symbol: "GTBIF", key: "gtbif", name: "Green Thumb Industries", category: "us_retail", exchange: "OTC", note: "US multi-state operator" },
  { symbol: "CURLF", key: "curlf", name: "Curaleaf", category: "us_retail", exchange: "OTC", note: "US multi-state operator" },
  { symbol: "TCNNF", key: "tcnnf", name: "Trulieve", category: "us_retail", exchange: "OTC", note: "US multi-state operator" },
  { symbol: "CRLBF", key: "crlbf", name: "Cresco Labs", category: "us_retail", exchange: "OTC", note: "US multi-state operator" },
  // Hemp / CBD economy.
  { symbol: "CWBHF", key: "cwbhf", name: "Charlotte's Web", category: "cbd_hemp", exchange: "OTC", note: "Hemp-derived CBD products" },
  { symbol: "IIPR", key: "iipr", name: "Innovative Industrial Properties", category: "cbd_hemp", exchange: "NYSE", note: "Cannabis-facility REIT" },
];

let cache: { at: number; rows: Row[] } | null = null;
const TTL = 10 * 60_000;

async function fetchRows(): Promise<Row[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.rows;
  const rows = (
    await Promise.all(
      SYMBOLS.map(async (s): Promise<Row | null> => {
        try {
          const res = await fetch(
            `${YAHOO}/${encodeURIComponent(s.symbol)}?range=1mo&interval=1d`,
            {
              headers: { "User-Agent": "Mozilla/5.0 (gwave.cc market board)" },
              signal: AbortSignal.timeout(8_000),
            },
          );
          if (!res.ok) return null;
          const data = (await res.json()) as {
            chart?: {
              result?: {
                meta?: {
                  regularMarketPrice?: number;
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
            ...s,
            usd: price,
            changePct: prev ? ((price - prev) / prev) * 100 : null,
            spark: closes.slice(-30),
            ts: (r?.meta?.regularMarketTime ?? 0) * 1000 || Date.now(),
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter((r): r is Row => r != null);
  if (rows.length > 0) cache = { at: Date.now(), rows };
  // Stale-before-error: yesterday's quote beats a broken board.
  return rows.length > 0 ? rows : (cache?.rows ?? []);
}

export async function GET() {
  const rows = await fetchRows();
  return NextResponse.json({ rows });
}
