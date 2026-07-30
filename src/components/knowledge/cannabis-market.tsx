"use client";

import * as React from "react";
import {
  GraduationCap,
  Languages,
  RefreshCw,
  Scale,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  CLANG_LABEL,
  CSTR,
  THAI_MARKETS,
  THAI_PRODUCTS,
  THAI_UNITS,
  nextCLang,
  type CLang,
} from "./cannabis-strings";

/**
 * Cannabis / hemp / CBD market board — EDUCATIONAL ONLY, rendered behind
 * requireAdult (18+).
 *
 * Two kinds of number live here, and the UI keeps them apart. Listed equities
 * (sector ETFs, Canadian producers, US MSOs, CBD firms, and the Thai SET names)
 * are real public quotes. Thai flower prices are not: no exchange trades the
 * flower, so those are hand-recorded trade quotes in their own log, labelled
 * with grade, area and date. Alongside them sits the Thai legal-compliance
 * panel — licensing, the 0.2 % THC line, the 2025 prescription rules — because
 * the people reading this page are operating inside that market.
 */

interface Row {
  symbol: string;
  key: string;
  name: string;
  category: "etf" | "producer" | "us_retail" | "cbd_hemp" | "thai";
  exchange: string;
  note: string;
  currency?: "USD" | "THB";
  usd: number;
  changePct: number | null;
  spark: number[];
  ts: number;
}

interface Quote {
  id: string;
  product_key: string;
  name: string;
  grade: string | null;
  price: number;
  currency: string;
  unit: string;
  market: string;
  note: string | null;
  quoted_at: string;
}

// Thailand first: this board's readers are mostly in that market.
const CATEGORIES = ["thai", "etf", "producer", "us_retail", "cbd_hemp"] as const;

export function CannabisMarket({ isAdmin = false }: { isAdmin?: boolean }) {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [error, setError] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lang, setLang] = React.useState<CLang>("my");

  React.useEffect(() => {
    const saved = window.localStorage.getItem("gwave-cmkt-lang");
    if (saved === "en" || saved === "my" || saved === "th") setLang(saved);
  }, []);

  const t = CSTR[lang];

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/cannabis/market");
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { rows: Row[] };
      setRows(body.rows);
      setError(false);
      // The Thai log rides the same refresh; its absence is never an error.
      try {
        const qr = await fetch("/api/cannabis/quotes");
        if (qr.ok) {
          const qb = (await qr.json()) as { quotes?: Quote[] };
          setQuotes(qb.quotes ?? []);
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
    const timer = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const sectionNote: Record<(typeof CATEGORIES)[number], string> = {
    thai: t.thaiNote,
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
                const next = nextCLang[l];
                window.localStorage.setItem("gwave-cmkt-lang", next);
                return next;
              })
            }
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Language"
          >
            <Languages className="h-3.5 w-3.5" />
            {CLANG_LABEL[nextCLang[lang]]}
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

      {/* Thai legal compliance — the page's readers are operating there. */}
      <section className="overflow-hidden rounded-xl border border-sky-500/40">
        <h2 className="flex items-center gap-2 border-b bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-800 dark:text-sky-300">
          <Scale className="h-4 w-4" />
          {t.legalTitle}
        </h2>
        <p className="whitespace-pre-line px-4 py-3 text-xs leading-relaxed">
          {t.legalThai}
        </p>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t.whyStocks}
      </p>

      {error && !rows ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          {t.loadError}
        </p>
      ) : null}

      <ThaiPriceLog
        quotes={quotes}
        lang={lang}
        isAdmin={isAdmin}
        onChanged={() => void load()}
      />

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
                            {r.currency === "THB" ? "฿" : "$"}
                            {r.usd.toLocaleString("en-US", {
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

/**
 * The Thai price log: hand-recorded dispensary and wholesale quotes, the only
 * honest source for a flower price. Admins record; everyone reads. Latest
 * quote per (product, market) — the log keeps history, the board shows now.
 */
function ThaiPriceLog({
  quotes,
  lang,
  isAdmin,
  onChanged,
}: {
  quotes: Quote[];
  lang: CLang;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const t = CSTR[lang];
  const [formOpen, setFormOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    productKey: "flower_indoor",
    name: "",
    grade: "",
    price: "",
    currency: "THB",
    unit: "gram",
    market: "Bangkok",
    note: "",
  });

  const latest: Quote[] = [];
  const seen = new Set<string>();
  for (const q of quotes) {
    const k = `${q.product_key}|${q.market}`;
    if (seen.has(k)) continue;
    seen.add(k);
    latest.push(q);
  }

  if (latest.length === 0 && !isAdmin) return null;

  async function submit() {
    const price = Number(form.price.replace(/,/g, ""));
    const name =
      form.name.trim() ||
      THAI_PRODUCTS.find((p) => p.key === form.productKey)?.[lang] ||
      form.productKey;
    if (!price || price <= 0 || !form.market.trim()) {
      setFormError(t.formErr);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/cannabis/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKey: form.productKey,
          name,
          grade: form.grade.trim() || undefined,
          price,
          currency: form.currency,
          unit: form.unit,
          market: form.market.trim(),
          note: form.note.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed");
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
    await fetch(`/api/cannabis/quotes?id=${encodeURIComponent(id)}`, {
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
            {THAI_PRODUCTS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, productKey: p.key, name: p[lang] }))
                }
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  form.productKey === p.key
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {p[lang]}
              </button>
            ))}
          </div>
          <input
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder={t.phName}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              {["THB", "USD", "MMK"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {THAI_UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1 sm:col-span-2">
            {THAI_MARKETS.map((m) => (
              <button
                key={m.en}
                type="button"
                onClick={() => setForm((f) => ({ ...f, market: m[lang] }))}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  form.market === m[lang]
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {m[lang]}
              </button>
            ))}
          </div>
          <input
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder={t.phMarket}
            value={form.market}
            onChange={(e) => setForm({ ...form, market: e.target.value })}
            maxLength={80}
          />
          <input
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
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
        <p className="p-4 text-sm text-muted-foreground">{t.logEmpty}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {latest.map((q) => (
              <tr key={q.id} className="border-b last:border-b-0">
                <td className="px-4 py-2.5">
                  <p className="font-semibold leading-tight">{q.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[q.grade, q.market].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <p className="font-bold tabular-nums">
                    {q.currency === "THB" ? "฿" : ""}
                    {q.price.toLocaleString("en-US")}
                    {q.currency !== "THB" ? ` ${q.currency}` : ""}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      /{q.unit}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {q.quoted_at}
                    {q.note ? ` · ${q.note}` : ""}
                  </p>
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
            ))}
          </tbody>
        </table>
      )}
      <p className="border-t px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {t.logDisclaimer}
      </p>
    </section>
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
