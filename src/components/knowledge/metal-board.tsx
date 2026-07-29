"use client";

import * as React from "react";
import { Gem, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

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
export function MetalBoard({
  rates,
}: {
  /** currency code → units per USD, from currency_rates. */
  rates: Record<string, number>;
}) {
  const [data, setData] = React.useState<MetalsResponse | null>(null);
  const [error, setError] = React.useState(false);
  const [unit, setUnit] = React.useState<(typeof DISPLAY_UNITS)[number]["key"]>("quoted");
  const [currency, setCurrency] = React.useState("USD");
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/metals");
      if (!res.ok) throw new Error();
      setData((await res.json()) as MetalsResponse);
      setError(false);
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
    { key: "precious", title: "အဖိုးတန်သတ္တု (Precious)" },
    { key: "base", title: "စက်မှုသတ္တု (Base / LME)" },
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
              {u.labelMy}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
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
          ဈေးနှုန်း ယူ၍မရသေးပါ — ခဏနေ ပြန်စမ်းပါ။
        </p>
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
                      return (
                        <tr key={m.key} className="border-b last:border-b-0">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold leading-tight">
                              {m.nameMy}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.name} · {m.exchange}
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
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })
        : null}

      {data && !data.sources.lmeConfigured ? (
        <p className="rounded-xl border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
          LME (ရော်တာဒမ်) — နီကယ်၊ သွပ်၊ ခဲမဖြူ၊ ခဲ နှင့် ရိုဒီယမ် ဈေးများ
          ပြရန် metals.dev မှ အခမဲ့ API key တစ်ခု လိုပါသည်။
          <code className="mx-1 rounded bg-muted px-1">METALS_DEV_API_KEY</code>
          ကို /etc/gwave-web.env တွင် ထည့်ပြီး redeploy လုပ်ပါ။
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        ရွှေ/ငွေ/ကြေးနီ — COMEX (နယူးယောက်) ကမ္ဘာ့စံဈေး၊ ၁၀ မိနစ်တစ်ကြိမ်။
        LME ဈေးများသည် မြန်မာ့သတ္တုဈေးကွက်က ခေါ်နေကျ「ရော်တာဒမ်ဈေး」ဖြစ်ပြီး
        ရက်စဉ် official settlement ဖြစ်သည်။ ရှန်ဟိုင်း (SHFE) နှင့်
        ဝူဖရမ်/APT ဈေးများမှာ licence ဝယ်ယူရသော feed များဖြစ်၍ မမှန်သော
        ကိန်းဂဏန်း မပြလိုသဖြင့် ချန်ထားပါသည်။ ဤဈေးနှုန်းများသည်
        ရည်ညွှန်းချက်သာဖြစ်ပြီး အရောင်းအဝယ် စာချုပ်ဈေး မဟုတ်ပါ။
      </p>
    </div>
  );
}

/** A 1-month closing-price line, coloured by direction. Pure SVG — this
 *  renders 11 times per load and must cost nothing. */
function Sparkline({ points, up }: { points: number[]; up: boolean }) {
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
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
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
