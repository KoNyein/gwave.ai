"use client";

import * as React from "react";
import {
  ChevronDown,
  Gem,
  HelpCircle,
  Languages,
  Mountain,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  HELP,
  METAL_INFO,
  MYANMAR_MINERALS,
  STR,
  type Lang,
} from "./metal-data";

interface Metal {
  key: string;
  name: string;
  nameMy: string;
  group: "precious" | "base";
  exchange: string;
  usd: number;
  unit: "toz" | "lb" | "t";
  changePct: number | null;
  spark: number[];
  ts: number;
}

interface MetalsResponse {
  metals: Metal[];
  sources: { comex: boolean; lme: boolean; lmeConfigured: boolean };
}

/** Grams per quoted unit — the bridge between exchanges and kitchen scales. */
const GRAMS: Record<Metal["unit"], number> = {
  toz: 31.1034768,
  lb: 453.59237,
  t: 1_000_000,
};

/** Display units the user can ask for, in grams. ကျပ်သား = 16.606 g — the
 *  unit every Myanmar gold shop actually quotes in. */
const DISPLAY_UNITS = [
  { key: "quoted", labelEn: "Market unit", labelMy: "ဈေးကွက်ယူနစ်", grams: 0 },
  { key: "kyattha", labelEn: "Kyattha (16.6 g)", labelMy: "ကျပ်သား", grams: 16.606 },
  { key: "gram", labelEn: "Gram", labelMy: "ဂရမ်", grams: 1 },
  { key: "kg", labelEn: "Kilogram", labelMy: "ကီလို", grams: 1000 },
] as const;

const UNIT_LABEL: Record<Metal["unit"], string> = {
  toz: "oz t",
  lb: "lb",
  t: "tonne",
};

/**
 * The live metal price board. Everything on it is a real quote from a named
 * market — the exchange column is not decoration, it is the provenance.
 */
interface MetalQuote {
  id: string;
  metal_key: string;
  name_my: string;
  grade: string | null;
  price: number;
  currency: string;
  unit: string;
  market: string;
  note: string | null;
  quoted_at: string;
}

export function MetalBoard({
  rates,
  isAdmin = false,
}: {
  /** currency code → units per USD, from currency_rates. */
  rates: Record<string, number>;
  isAdmin?: boolean;
}) {
  const [data, setData] = React.useState<MetalsResponse | null>(null);
  const [error, setError] = React.useState(false);
  const [unit, setUnit] = React.useState<(typeof DISPLAY_UNITS)[number]["key"]>("quoted");
  const [currency, setCurrency] = React.useState("USD");
  const [refreshing, setRefreshing] = React.useState(false);
  const [quotes, setQuotes] = React.useState<MetalQuote[]>([]);
  const [lang, setLang] = React.useState<Lang>("my");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    const saved = window.localStorage.getItem("gwave-metals-lang");
    if (saved === "en" || saved === "my") setLang(saved);
  }, []);

  function switchLang() {
    setLang((l) => {
      const next: Lang = l === "my" ? "en" : "my";
      window.localStorage.setItem("gwave-metals-lang", next);
      return next;
    });
  }

  const t = STR[lang];

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/metals");
      if (!res.ok) throw new Error();
      setData((await res.json()) as MetalsResponse);
      setError(false);
      // The market log rides the same refresh; its absence is never an error.
      try {
        const qr = await fetch("/api/metals/quotes");
        if (qr.ok) {
          const body = (await qr.json()) as { quotes?: MetalQuote[] };
          setQuotes(body.quotes ?? []);
        }
      } catch {}
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    // Markets move; the reader shouldn't have to. COMEX quotes are cached
    // 10 min server-side, so this is one cheap hit per 5 minutes per tab.
    const timer = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const currencies = ["USD", ...Object.keys(rates).filter((c) => c !== "USD")];

  function convert(m: Metal): { value: number; suffix: string } | null {
    const rate = currency === "USD" ? 1 : rates[currency];
    if (!rate) return null;
    const chosen = DISPLAY_UNITS.find((u) => u.key === unit)!;
    if (chosen.grams === 0) {
      return { value: m.usd * rate, suffix: `/${UNIT_LABEL[m.unit]}` };
    }
    const perGram = m.usd / GRAMS[m.unit];
    return {
      value: perGram * chosen.grams * rate,
      suffix: `/${chosen.key === "kyattha" ? "ကျပ်သား" : chosen.key}`,
    };
  }

  function fmt(v: number): string {
    const digits = v >= 1000 ? 0 : v >= 10 ? 2 : 4;
    return v.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  const groups: { key: Metal["group"]; title: string }[] = [
    { key: "precious", title: t.groupPrecious },
    { key: "base", title: t.groupBase },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {DISPLAY_UNITS.map((u) => (
            <button
              key={u.key}
              type="button"
              onClick={() => setUnit(u.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                unit === u.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "my" ? u.labelMy : u.labelEn}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={switchLang}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Language"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "my" ? "EN" : "မြန်မာ"}
          </button>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
            aria-label="Currency"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {error && !data ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          {t.loadError}
        </p>
      ) : null}

      {data ? (
        <p className="text-[11px] text-muted-foreground">{t.tapHint}</p>
      ) : null}

      {data
        ? groups.map((g) => {
            const rows = data.metals.filter((m) => m.group === g.key);
            if (rows.length === 0) return null;
            return (
              <section key={g.key} className="overflow-hidden rounded-xl border">
                <h2 className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-sm font-semibold">
                  <Gem className="h-4 w-4 text-primary" />
                  {g.title}
                </h2>
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((m) => {
                      const c = convert(m);
                      const open = expanded === m.key;
                      return (<React.Fragment key={m.key}>
                        <tr
                          className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                          onClick={() => setExpanded(open ? null : m.key)}
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-semibold leading-tight">
                              {lang === "my" ? m.nameMy : m.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lang === "my" ? m.name : m.nameMy} · {m.exchange}
                            </p>
                          </td>
                          <td className="px-2 py-2.5">
                            {m.spark.length > 1 ? (
                              <Sparkline
                                points={m.spark}
                                up={(m.changePct ?? 0) >= 0}
                              />
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <p className="font-bold tabular-nums">
                              {c ? `${fmt(c.value)} ${currency}` : "—"}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                {c?.suffix}
                              </span>
                            </p>
                            {m.changePct != null ? (
                              <p
                                className={`flex items-center justify-end gap-0.5 text-xs font-medium ${
                                  m.changePct >= 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {m.changePct >= 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {m.changePct >= 0 ? "+" : ""}
                                {m.changePct.toFixed(2)}%
                              </p>
                            ) : null}
                          </td>
                        </tr>
                        {open ? (
                          <tr className="border-b bg-muted/20 last:border-b-0">
                            <td colSpan={3} className="px-4 py-3">
                              <MetalDetail
                                m={m}
                                lang={lang}
                                currency={currency}
                                rates={rates}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>);
                    })}
                  </tbody>
                </table>
              </section>
            );
          })
        : null}

      <MarketLog
        quotes={quotes}
        live={data?.metals ?? []}
        isAdmin={isAdmin}
        lang={lang}
        onChanged={() => void load()}
      />

      <MineralGuide live={data?.metals ?? []} quotes={quotes} lang={lang} />

      <HelpSection lang={lang} />

      {data && !data.sources.lmeConfigured ? (
        <p className="rounded-xl border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
          {t.lmeHintPre}
          <code className="mx-1 rounded bg-muted px-1">METALS_DEV_API_KEY</code>
          {t.lmeHintPost}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">{t.footer}</p>
    </div>
  );
}

/** Expanded row: month chart, unit conversions, background, provenance. */
function MetalDetail({
  m,
  lang,
  currency,
  rates,
}: {
  m: Metal;
  lang: Lang;
  currency: string;
  rates: Record<string, number>;
}) {
  const t = STR[lang];
  const rate = currency === "USD" ? 1 : rates[currency];
  const perGram = m.usd / GRAMS[m.unit];
  const convRows = [
    { label: lang === "my" ? "ကျပ်သား" : "Kyattha (16.6 g)", grams: 16.606 },
    { label: lang === "my" ? "ဂရမ်" : "Gram", grams: 1 },
    { label: lang === "my" ? "ကီလို" : "Kilogram", grams: 1000 },
    { label: lang === "my" ? "တန်" : "Tonne", grams: 1_000_000 },
  ];
  const info = METAL_INFO[m.key];
  // 1-month stats from the sparkline closes — free extra signal, no fetch.
  const stats =
    m.spark.length > 1
      ? {
          high: Math.max(...m.spark),
          low: Math.min(...m.spark),
          avg: m.spark.reduce((a, b) => a + b, 0) / m.spark.length,
        }
      : null;
  const statLabels =
    lang === "my"
      ? ["၁လ အမြင့်", "၁လ အနိမ့်", "၁လ ပျမ်းမျှ"]
      : ["1-mo high", "1-mo low", "1-mo avg"];
  return (
    <div className="space-y-3 text-sm">
      {m.spark.length > 1 ? (
        <Sparkline points={m.spark} up={(m.changePct ?? 0) >= 0} wide />
      ) : null}
      {stats ? (
        <div className="grid grid-cols-3 gap-1">
          {[stats.high, stats.low, stats.avg].map((v, i) => (
            <div
              key={statLabels[i]}
              className="rounded-md border bg-background px-2 py-1.5"
            >
              <p className="text-[11px] text-muted-foreground">
                {statLabels[i]} (USD/{UNIT_LABEL[m.unit]})
              </p>
              <p className="font-semibold tabular-nums">
                {v.toLocaleString("en-US", {
                  maximumFractionDigits: v >= 100 ? 0 : 2,
                })}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {rate ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">
            {t.convTitle} ({currency})
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {convRows.map((r) => {
              const v = perGram * r.grams * rate;
              return (
                <div
                  key={r.label}
                  className="rounded-md border bg-background px-2 py-1.5"
                >
                  <p className="text-[11px] text-muted-foreground">{r.label}</p>
                  <p className="font-semibold tabular-nums">
                    {v.toLocaleString("en-US", {
                      maximumFractionDigits: v >= 100 ? 0 : v >= 1 ? 2 : 4,
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {info ? (
        <p className="leading-relaxed text-muted-foreground">{info[lang]}</p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        {t.updated}: {new Date(m.ts).toLocaleString()} · {m.exchange}
      </p>
    </div>
  );
}

/**
 * The Myanmar minerals guide — regions, legal status and world-price link
 * for each mineral the country produces. Educational: the uranium entry is
 * a warning, deliberately without a price, because private trade in
 * radioactive minerals is illegal.
 */
function MineralGuide({
  live,
  quotes,
  lang,
}: {
  live: Metal[];
  quotes: MetalQuote[];
  lang: Lang;
}) {
  const t = STR[lang];
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <section className="overflow-hidden rounded-xl border">
      <h2 className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-sm font-semibold">
        <Mountain className="h-4 w-4 text-primary" />
        {t.guideTitle}
      </h2>
      <p className="border-b px-4 py-2 text-xs leading-relaxed text-muted-foreground">
        {t.guideIntro}
      </p>
      <ul>
        {MYANMAR_MINERALS.map((mineral) => {
          const isOpen = open === mineral.key;
          const liveRow = mineral.liveKey
            ? live.find((m) => m.key === mineral.liveKey)
            : undefined;
          const quote = mineral.logMatch
            ? quotes.find((q) => q.name_my.includes(mineral.logMatch!))
            : undefined;
          return (
            <li key={mineral.key} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : mineral.key)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm"
              >
                <span
                  className={`font-semibold ${mineral.danger ? "text-red-600" : ""}`}
                >
                  {lang === "my" ? mineral.nameMy : mineral.nameEn}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen ? (
                <div className="space-y-2 px-4 pb-3 text-sm">
                  <p>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t.regions}:{" "}
                    </span>
                    {mineral.regions[lang]}
                  </p>
                  <p
                    className={
                      mineral.danger
                        ? "rounded-md border border-red-300 bg-red-50 p-2 leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                        : "leading-relaxed"
                    }
                  >
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t.legality}:{" "}
                    </span>
                    {mineral.legal[lang]}
                  </p>
                  {liveRow ? (
                    <p>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t.worldPrice}:{" "}
                      </span>
                      <span className="font-semibold tabular-nums">
                        $
                        {liveRow.usd.toLocaleString("en-US", {
                          maximumFractionDigits:
                            liveRow.unit === "t" ? 0 : 2,
                        })}
                        /{UNIT_LABEL[liveRow.unit]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {liveRow.exchange}
                      </span>
                    </p>
                  ) : mineral.danger ? null : (
                    <p className="text-xs text-muted-foreground">{t.noFeed}</p>
                  )}
                  {quote ? (
                    <p>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t.latestLog}:{" "}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {quote.price.toLocaleString("en-US")} {quote.currency}/
                        {quote.unit}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {quote.market} · {quote.quoted_at}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Plain-language user guide. <details> keeps it dependency-free. */
function HelpSection({ lang }: { lang: Lang }) {
  const t = STR[lang];
  return (
    <section className="overflow-hidden rounded-xl border">
      <h2 className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-sm font-semibold">
        <HelpCircle className="h-4 w-4 text-primary" />
        {t.helpTitle}
      </h2>
      {HELP.map((h) => (
        <details
          key={h.q.en}
          className="border-b px-4 py-2 text-sm last:border-b-0"
        >
          <summary className="cursor-pointer font-medium">{h.q[lang]}</summary>
          <p className="pb-1 pt-2 leading-relaxed text-muted-foreground">
            {h.a[lang]}
          </p>
        </details>
      ))}
    </section>
  );
}

/**
 * The market log (ဈေးမှတ်တမ်း): hand-recorded quotes for the metals and
 * markets no feed can price — antimony, ore grades, the Muse border. Shown
 * apart from the live rows and labelled with market and date, so a reader
 * always knows which numbers are a wire and which are a person.
 */
/** Burmese trade name → the live board row it should be compared against. */
const QUOTE_TO_LIVE: Record<string, string> = {
  "ခနောက်စိမ်း": "antimony",
  "ခဲမဖြူ": "lme_tin",
  "သွပ်": "lme_zinc",
  "ခဲမ": "lme_zinc",
  "ခဲ": "lme_lead",
  "နီကယ်": "lme_nickel",
  "ကြေးနီ": "copper",
  "အလူမီနီယမ်": "aluminum",
  "ရွှေ": "gold",
  "ငွေ": "silver",
};

/** Common entries first — a border trader shouldn't have to type. Rare
 *  earths (Kachin's dysprosium/terbium trade through Pangwa) have no public
 *  exchange feed at all, so the log is the only place they can live. */
const QUICK_METALS = [
  "ခနောက်စိမ်း",
  "ခဲမဖြူ",
  "ရှားပါးမြေ (Dysprosium)",
  "ရှားပါးမြေ (Terbium)",
  "သွပ်",
  "ခဲ",
  "နီကယ်",
  "ကြေးနီ",
];
/** Every border gate trades at its own price — transport difficulty and the
 *  local security situation differ gate to gate — and the log keeps one row
 *  per (metal, market), so each gate gets its own quote. China border, then
 *  the Thai-border gates north to south, then domestic, then world. */
const QUICK_MARKETS = [
  "မူဆယ်နယ်စပ်",
  "ကချင် (ပန်ဝါနယ်စပ်)",
  "တာချီလိတ်",
  "မယ်စဲ (ကယား)",
  "၁၃ မိုင်ဂိတ် (ကယား)",
  "၁၄ မိုင်ဂိတ် (ကယား)",
  "မြဝတီ",
  "မဲသဝေါ (မြဝတီ)",
  "မဲသလေ (မြဝတီ)",
  "ထီးခီး (ထားဝယ်)",
  "နတ်အိမ်တောင် (တနင်္သာရီ)",
  "ကော့သောင်း (ရနောင်းဂိတ်)",
  "ရန်ကုန်",
  "LME (ကမ္ဘာ့ဈေး)",
];

/** A quote whose market says LME/world belongs in the world section of the
 *  log — the hand-recorded stand-in for feeds the free tier doesn't carry
 *  (tin). Everything else is a Myanmar border/local price. */
const WORLD_MARKET_RE = /lme|rotterdam|world|ကမ္ဘာ|ရော်တာဒမ်/i;

function MarketLog({
  quotes,
  live,
  isAdmin,
  lang,
  onChanged,
}: {
  quotes: MetalQuote[];
  live: Metal[];
  isAdmin: boolean;
  lang: Lang;
  onChanged: () => void;
}) {
  const t = STR[lang];
  const [formOpen, setFormOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    nameMy: "ခနောက်စိမ်း",
    grade: "",
    price: "",
    currency: "CNY",
    unit: "တန်",
    market: "မူဆယ်နယ်စပ်",
    note: "",
  });

  // Latest quote per (metal, market) — the log serves history, the board
  // shows now.
  const latest: MetalQuote[] = [];
  const seen = new Set<string>();
  for (const q of quotes) {
    const k = `${q.metal_key}|${q.market}`;
    if (seen.has(k)) continue;
    seen.add(k);
    latest.push(q);
  }

  if (latest.length === 0 && !isAdmin) return null;

  // The world section on top, Myanmar border/local prices below — the
  // reader always knows which is which.
  const world = latest.filter((q) => WORLD_MARKET_RE.test(q.market));
  const local = latest.filter((q) => !WORLD_MARKET_RE.test(q.market));

  /** The Burmese trade name this quote is about, longest first so ခဲမဖြူ
   *  matches tin before ခဲ matches lead. */
  function tradeName(q: MetalQuote): string | null {
    const names = Object.keys(QUOTE_TO_LIVE).sort(
      (a, b) => b.length - a.length,
    );
    for (const name of names) {
      if (q.name_my.includes(name)) return name;
    }
    return null;
  }

  /** The matching live exchange row, so a border price is never read in a
   *  vacuum. */
  function reference(q: MetalQuote): Metal | null {
    const name = tradeName(q);
    if (!name) return null;
    return live.find((m) => m.key === QUOTE_TO_LIVE[name]) ?? null;
  }

  /** No live feed (tin) → fall back to the hand-logged world quote. */
  function loggedWorld(q: MetalQuote): MetalQuote | null {
    const name = tradeName(q) ?? q.name_my;
    return world.find((w) => w.id !== q.id && w.name_my.includes(name)) ?? null;
  }

  async function submit() {
    const price = Number(form.price.replace(/,/g, ""));
    if (!form.nameMy.trim() || !price || price <= 0 || !form.market.trim()) {
      setFormError(t.formErr);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/metals/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // A stable key groups revisions of the same quote; the Burmese
          // name is the identity the admin actually typed.
          metalKey: form.nameMy.trim().toLowerCase(),
          nameMy: form.nameMy.trim(),
          grade: form.grade.trim() || undefined,
          price,
          currency: form.currency,
          unit: form.unit,
          market: form.market.trim(),
          note: form.note.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? "မအောင်မြင်ပါ");
      setForm((f) => ({ ...f, price: "", note: "" }));
      setFormOpen(false);
      onChanged();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/metals/quotes?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {});
    onChanged();
  }

  return (
    <section className="overflow-hidden rounded-xl border">
      <h2 className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-sm font-semibold">
        <span>{t.logTitle}</span>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground"
          >
            {formOpen ? t.logClose : t.logAdd}
          </button>
        ) : null}
      </h2>

      {isAdmin && formOpen ? (
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2">
          <div className="flex flex-wrap gap-1 sm:col-span-2">
            {QUICK_METALS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm((f) => ({ ...f, nameMy: n }))}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  form.nameMy === n
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder={t.phName}
            value={form.nameMy}
            onChange={(e) => setForm({ ...form, nameMy: e.target.value })}
            maxLength={80}
          />
          <input
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder={t.phGrade}
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
            maxLength={80}
          />
          <div className="flex gap-2">
            <input
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              placeholder={t.phPrice}
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {["CNY", "USD", "MMK", "THB"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {["တန်", "ကီလို", "ပိဿာ"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1 sm:col-span-2">
            {QUICK_MARKETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm((f) => ({ ...f, market: n }))}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  form.market === n
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground sm:col-span-2">
            {t.logGateNote}
          </p>
          <input
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder={t.phMarket}
            value={form.market}
            onChange={(e) => setForm({ ...form, market: e.target.value })}
            maxLength={80}
          />
          <input
            className="rounded-md border bg-background px-2 py-1.5 text-sm sm:col-span-2"
            placeholder={t.phNote}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            maxLength={300}
          />
          {formError ? (
            <p className="text-xs text-red-600 sm:col-span-2">{formError}</p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2"
          >
            {busy ? t.logSaving : t.logSave}
          </button>
        </div>
      ) : null}

      {latest.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          {t.logEmpty}
        </p>
      ) : (
        (() => {
          const row = (q: MetalQuote, withRef: boolean) => (
            <tr key={q.id} className="border-b last:border-b-0">
              <td className="px-4 py-2.5">
                <p className="font-semibold leading-tight">{q.name_my}</p>
                <p className="text-xs text-muted-foreground">
                  {[q.grade, q.market].filter(Boolean).join(" · ")}
                </p>
              </td>
              <td className="px-4 py-2.5 text-right">
                <p className="font-bold tabular-nums">
                  {q.price.toLocaleString("en-US")} {q.currency}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    /{q.unit}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {q.quoted_at}
                  {q.note ? ` · ${q.note}` : ""}
                </p>
                {withRef
                  ? (() => {
                      const ref = reference(q);
                      if (ref) {
                        return (
                          <p className="text-[11px] text-sky-700 dark:text-sky-400">
                            {t.worldPrice} ({ref.exchange}): $
                            {ref.usd.toLocaleString("en-US", {
                              maximumFractionDigits:
                                ref.unit === "t" ? 0 : 2,
                            })}
                            /{UNIT_LABEL[ref.unit]}
                          </p>
                        );
                      }
                      const wq = loggedWorld(q);
                      if (wq) {
                        return (
                          <p className="text-[11px] text-sky-700 dark:text-sky-400">
                            {t.worldPrice} ({wq.market}):{" "}
                            {wq.price.toLocaleString("en-US")} {wq.currency}/
                            {wq.unit} · {wq.quoted_at}
                          </p>
                        );
                      }
                      return null;
                    })()
                  : null}
              </td>
              {isAdmin ? (
                <td className="pr-3 text-right">
                  <button
                    type="button"
                    onClick={() => void remove(q.id)}
                    className="text-xs text-muted-foreground hover:text-red-600"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </td>
              ) : null}
            </tr>
          );
          return (
            <>
              {world.length > 0 ? (
                <>
                  <p className="border-b bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
                    {t.logWorldSection}
                  </p>
                  <table className="w-full text-sm">
                    <tbody>{world.map((q) => row(q, false))}</tbody>
                  </table>
                </>
              ) : null}
              {local.length > 0 ? (
                <>
                  <p className="border-b border-t bg-muted/40 px-4 py-1.5 text-xs font-semibold">
                    {t.logLocalSection}
                  </p>
                  <table className="w-full text-sm">
                    <tbody>{local.map((q) => row(q, true))}</tbody>
                  </table>
                </>
              ) : null}
            </>
          );
        })()
      )}
      <p className="border-t px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {t.logDisclaimer}
      </p>
    </section>
  );
}

/** A 1-month closing-price line, coloured by direction. Pure SVG — this
 *  renders 11 times per load and must cost nothing. */
function Sparkline({
  points,
  up,
  wide = false,
}: {
  points: number[];
  up: boolean;
  wide?: boolean;
}) {
  const w = wide ? 320 : 96;
  const h = wide ? 64 : 28;
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
    <svg
      width={wide ? "100%" : w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={wide ? "none" : undefined}
      className="text-muted-foreground"
      aria-hidden
    >
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
