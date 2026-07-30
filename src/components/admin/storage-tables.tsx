"use client";

import * as React from "react";

import { SearchBar } from "@/components/ui/search-bar";

interface Row {
  table: string;
  rows: number;
  totalBytes: number;
  heapBytes: number;
  indexBytes: number;
  toastBytes: number;
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)} ${units[u]}`;
}

const num = new Intl.NumberFormat("en-US");

/**
 * Every table in the database, biggest first, with the three things that
 * actually explain a number: how many rows it holds, how much of its size is
 * the rows themselves, and how much is indexes.
 *
 * The split matters — a table that is 80% index is usually over-indexed, and a
 * table with huge TOAST is storing big text or arrays. A single "size" column
 * would hide both.
 */
export function StorageTables({
  rows,
  dbBytes,
}: {
  rows: Row[];
  dbBytes: number;
}) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"size" | "rows" | "index">("size");

  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => !needle || r.table.toLowerCase().includes(needle))
    .sort((a, b) =>
      sort === "rows"
        ? b.rows - a.rows
        : sort === "index"
          ? b.indexBytes - a.indexBytes
          : b.totalBytes - a.totalBytes,
    );

  const max = Math.max(1, ...shown.map((r) => r.totalBytes));
  const shownBytes = shown.reduce((n, r) => n + r.totalBytes, 0);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={q}
          onValueChange={setQ}
          placeholder="Table name ရှာရန်"
          containerClassName="flex-1 min-w-[200px]"
        />
        <div className="flex gap-1">
          {(
            [
              ["size", "အရွယ်အစား"],
              ["rows", "Row အရေအတွက်"],
              ["index", "Index"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sort === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {shown.length} table · {bytes(shownBytes)}
        {dbBytes > 0
          ? ` (database တစ်ခုလုံး၏ ${Math.round((shownBytes / dbBytes) * 100)}%)`
          : ""}
      </p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Table</th>
              <th className="px-3 py-2 text-right font-medium">Rows</th>
              <th className="px-3 py-2 text-right font-medium">Data</th>
              <th className="px-3 py-2 text-right font-medium">Index</th>
              <th className="px-3 py-2 text-right font-medium">TOAST</th>
              <th className="px-3 py-2 text-right font-medium">စုစုပေါင်း</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.table} className="border-t">
                <td className="px-3 py-1.5">
                  <span className="font-medium">{r.table}</span>
                  {/* The bar is the fastest way to see which few tables are
                      the database — the numbers alone bury that. */}
                  <span className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max((r.totalBytes / max) * 100, 1)}%`,
                      }}
                    />
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {r.rows > 0 ? `~${num.format(r.rows)}` : "0"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {bytes(r.heapBytes)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {bytes(r.indexBytes)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {r.toastBytes > 0 ? bytes(r.toastBytes) : "–"}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                  {bytes(r.totalBytes)}
                </td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  ရှာဖွေမှုနှင့် ကိုက်ညီသော table မရှိပါ။
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
