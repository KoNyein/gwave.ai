"use client";

import * as React from "react";
import {
  GraduationCap,
  Languages,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

/**
 * Cannabis / hemp / CBD market board — EDUCATIONAL ONLY, rendered behind
 * requireAdult (18+). Shows the public listed-equity market (sector ETFs,
 * producers, US retailers, CBD companies) because no exchange trades
 * cannabis as a commodity and the wholesale benchmarks are licensed feeds
 * — and says so instead of inventing numbers.
 */

interface Row {
  symbol: string;
  key: string;
  name: string;
  category: "etf" | "producer" | "us_retail" | "cbd_hemp";
  exchange: string;
  note: string;
  usd: number;
  changePct: number | null;
  spark: number[];
  ts: number;
}

type Lang = "my" | "en";

const STRINGS = {
  my: {
    title: "ဆေးခြောက် / Hemp / CBD ဈေးကွက် (ပညာပေး)",
    adult: "၁၈+ သီးသန့်",
    edu: "ပညာပေးရည်ရွယ်ချက်သာ",
    loadError: "ဈေးနှုန်း ယူ၍မရသေးပါ — ခဏနေ ပြန်စမ်းပါ။",
    etf: "ကဏ္ဍ ETF များ (ဈေးကွက်အညွှန်းကိန်း)",
    producer: "ထုတ်လုပ်သူကြီးများ (ကနေဒါ)",
    us_retail: "အမေရိကန် လက်လီလုပ်ငန်းများ (OTC)",
    cbd_hemp: "Hemp / CBD စီးပွားရေး",
    etfNote:
      "ကုမ္ပဏီတစ်ခုတည်းမဟုတ်ဘဲ ကဏ္ဍတစ်ခုလုံးကို ကိုယ်စားပြုတဲ့ ရန်ပုံငွေများ — ဈေးကွက်အခြေအနေ ခြုံကြည့်ရန် အသင့်တော်ဆုံး။",
    producerNote:
      "ကနေဒါက ဖက်ဒရယ်အဆင့် တရားဝင်တဲ့ ကမ္ဘာ့ပထမဆုံး ဈေးကွက် — ထုတ်လုပ်သူကြီးများ NASDAQ မှာ စာရင်းဝင်။",
    usRetailNote:
      "အမေရိကန်မှာ ပြည်နယ်အဆင့်သာ တရားဝင်ပြီး ဖက်ဒရယ်ဥပဒေကြောင့် ကုမ္ပဏီတွေ OTC ဈေးကွက်မှာသာ ရောင်းဝယ်ရ။",
    cbdNote:
      "Hemp (THC နည်း) နှင့် CBD ထုတ်ကုန် စီးပွားရေး — ကမ္ဘာ့နိုင်ငံအများအပြားမှာ ဆေးခြောက်နှင့် ဥပဒေအရ သီးခြားစီ သတ်မှတ်။",
    whyStocks:
      "ဘာလို့ ကုမ္ပဏီရှယ်ယာဈေးတွေလဲ? — ဆေးခြောက်ကို commodity အနေနဲ့ ရောင်းဝယ်တဲ့ exchange မရှိပါ။ လက်ကား hemp/CBD စံဈေး (Hemp Benchmarks™) တွေက licence ဝယ်ရတဲ့ feed များဖြစ်လို့ မမှန်တဲ့ဂဏန်း မပြဘဲ အများပြည်သူကြည့်နိုင်တဲ့ ရှယ်ယာဈေးများကိုသာ ပြထားပါသည်။",
    disclaimer:
      "⚠️ သတိပေးချက် — ဤစာမျက်နှာသည် ပညာပေးရည်ရွယ်ချက်သာဖြစ်သည်။ ရင်းနှီးမြှုပ်နှံမှု အကြံဉာဏ် မဟုတ်ပါ။ မြန်မာနိုင်ငံတွင် ဆေးခြောက် လက်ဝယ်ထား/ရောင်းဝယ်ခြင်းသည် တရားမဝင်ပါ — ဤအချက်အလက်များသည် တရားဝင်ဈေးကွက်ရှိသော နိုင်ငံများ (အမေရိကန်၊ ကနေဒါ စသည်) ၏ stock exchange ဈေးများသာဖြစ်သည်။ ရောင်းဝယ်ရန် တိုက်တွန်းခြင်း လုံးဝမဟုတ်ပါ။",
    updated: "နောက်ဆုံး update",
    refresh: "ပြန်ဆွဲ",
  },
  en: {
    title: "Cannabis / Hemp / CBD markets (educational)",
    adult: "18+ only",
    edu: "Educational purposes only",
    loadError: "Could not load prices — try again shortly.",
    etf: "Sector ETFs (market index)",
    producer: "Licensed producers (Canada)",
    us_retail: "US retailers (OTC)",
    cbd_hemp: "Hemp / CBD economy",
    etfNote:
      "Funds that track the whole sector rather than one company — the best single view of market conditions.",
    producerNote:
      "Canada is the first federally legal market; the major producers list on NASDAQ.",
    usRetailNote:
      "US cannabis is state-legal only, so these companies trade OTC because of federal law.",
    cbdNote:
      "The hemp (low-THC) and CBD product economy — legally distinct from cannabis in most countries.",
    whyStocks:
      "Why stock prices? No exchange trades cannabis as a commodity, and wholesale hemp/CBD benchmarks (Hemp Benchmarks™) are licensed feeds — so rather than invent numbers, this board shows the public listed-equity market.",
    disclaimer:
      "⚠️ Disclaimer — this page is for education only and is NOT investment advice. Cannabis possession and trade are illegal in Myanmar; these are stock-exchange prices from jurisdictions with legal markets (US, Canada). Nothing here is an inducement to trade.",
    updated: "Last updated",
    refresh: "Refresh",
  },
} as const;

const CATEGORIES = ["etf", "producer", "us_retail", "cbd_hemp"] as const;

export function CannabisMarket() {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lang, setLang] = React.useState<Lang>("my");

  React.useEffect(() => {
    const saved = window.localStorage.getItem("gwave-cmkt-lang");
    if (saved === "en" || saved === "my") setLang(saved);
  }, []);

  const t = STRINGS[lang];

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/cannabis/market");
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { rows: Row[] };
      setRows(body.rows);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const sectionNote: Record<(typeof CATEGORIES)[number], string> = {
    etf: t.etfNote,
    producer: t.producerNote,
    us_retail: t.usRetailNote,
    cbd_hemp: t.cbdNote,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-600/10 px-3 py-1 text-xs font-bold text-red-600">
          <ShieldAlert className="h-3.5 w-3.5" /> {t.adult}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          <GraduationCap className="h-3.5 w-3.5" /> {t.edu}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setLang((l) => {
                const next: Lang = l === "my" ? "en" : "my";
                window.localStorage.setItem("gwave-cmkt-lang", next);
                return next;
              })
            }
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Language"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "my" ? "EN" : "မြန်မာ"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t.refresh}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed">
        {t.disclaimer}
      </p>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t.whyStocks}
      </p>

      {error && !rows ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          {t.loadError}
        </p>
      ) : null}

      {rows
        ? CATEGORIES.map((cat) => {
            const list = rows.filter((r) => r.category === cat);
            if (list.length === 0) return null;
            return (
              <section key={cat} className="overflow-hidden rounded-xl border">
                <h2 className="border-b bg-muted/50 px-4 py-2 text-sm font-semibold">
                  {t[cat]}
                </h2>
                <p className="border-b px-4 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {sectionNote[cat]}
                </p>
                <table className="w-full text-sm">
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.key} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold leading-tight">
                            {r.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.symbol} · {r.exchange} · {r.note}
                          </p>
                        </td>
                        <td className="px-2 py-2.5">
                          {r.spark.length > 1 ? (
                            <MiniSpark
                              points={r.spark}
                              up={(r.changePct ?? 0) >= 0}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <p className="font-bold tabular-nums">
                            ${r.usd.toLocaleString("en-US", {
                              maximumFractionDigits: r.usd >= 100 ? 0 : 2,
                            })}
                          </p>
                          {r.changePct != null ? (
                            <p
                              className={`flex items-center justify-end gap-0.5 text-xs font-medium ${
                                r.changePct >= 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }`}
                            >
                              {r.changePct >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {r.changePct >= 0 ? "+" : ""}
                              {r.changePct.toFixed(2)}%
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })
        : null}

      {rows?.[0] ? (
        <p className="text-[11px] text-muted-foreground">
          {t.updated}: {new Date(rows[0]!.ts).toLocaleString()} · Yahoo Finance
        </p>
      ) : null}
    </div>
  );
}

function MiniSpark({ points, up }: { points: number[]; up: boolean }) {
  const w = 96;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)},${(
          h -
          ((p - min) / span) * (h - 4) -
          2
        ).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={up ? "#059669" : "#dc2626"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
