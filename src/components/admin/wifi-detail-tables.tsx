"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchBar } from "@/components/ui/search-bar";
import type {
  WatchlistRow,
  WifiCluster,
  WifiNetworkRow,
} from "@/lib/db/wifi-admin";

/**
 * WiGLE-style detail for the WiFi dashboard: the full access-point table with
 * vendor / encryption / channel / band, the radio and client breakdown charts,
 * the dense-cluster leads, and the admin watchlist.
 *
 * The cluster section is worded carefully on purpose. Many access points in
 * one building is a signal that SOMETHING organised is there — a hotel, a
 * campus, an office park, or one of the border scam compounds. It is a place to
 * look, never a conclusion, and the only thing that goes on the record is an
 * admin's own note.
 */

const RISK_COLOUR: Record<string, string> = {
  confirmed: "text-red-600 border-red-400 bg-red-500/10",
  suspect: "text-amber-600 border-amber-400 bg-amber-500/10",
  watch: "text-sky-600 border-sky-400 bg-sky-500/10",
  cleared: "text-muted-foreground border-muted bg-muted/40",
};

function encColour(label: string): string {
  const l = label.toUpperCase();
  if (l === "OPEN") return "#dc2626";
  if (l === "WEP") return "#ea580c";
  if (l.startsWith("WPA3")) return "#16a34a";
  if (l.startsWith("WPA2")) return "#65a30d";
  if (l.startsWith("WPA")) return "#f0b429";
  return "#94a3b8";
}

function ChartCard({
  title,
  rows,
  colour = "#2563eb",
  colourBy,
  height = 260,
  width = 110,
}: {
  title: string;
  rows: { label: string; count: number }[];
  colour?: string;
  colourBy?: (label: string) => string;
  height?: number;
  width?: number;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
            <XAxis type="number" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="label" fontSize={10} width={width} />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} fill={colour}>
              {colourBy
                ? rows.map((r) => (
                    <Cell key={r.label} fill={colourBy(r.label)} />
                  ))
                : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function WifiDetailTables({
  networks,
  clusters,
  watchlist,
  charts,
}: {
  networks: WifiNetworkRow[];
  clusters: WifiCluster[];
  watchlist: WatchlistRow[];
  charts: {
    byBand: { label: string; count: number }[];
    byChannel: { label: string; count: number }[];
    byVendor: { label: string; count: number }[];
    byEncryption: { label: string; count: number }[];
    byBrowser: { label: string; count: number }[];
    byOs: { label: string; count: number }[];
    byApp: { label: string; count: number }[];
    wpsCount: number;
    hiddenCount: number;
  };
}) {
  const [filter, setFilter] = React.useState("");
  const [onlyFlagged, setOnlyFlagged] = React.useState(false);

  const needle = filter.trim().toLowerCase();
  const rows = networks.filter((n) => {
    if (onlyFlagged && !n.watch) return false;
    if (!needle) return true;
    return (
      (n.ssid ?? "").toLowerCase().includes(needle) ||
      n.bssid.includes(needle) ||
      (n.vendor ?? "").toLowerCase().includes(needle) ||
      n.encryption.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-4">
      {/* Radio detail */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Encryption အမျိုးအစား (AP)"
          rows={charts.byEncryption}
          colourBy={encColour}
          width={130}
        />
        <ChartCard
          title="လှိုင်း (band) အလိုက်"
          rows={charts.byBand}
          colour="#0891b2"
          height={200}
          width={80}
        />
        <ChartCard
          title="Channel အသုံးအများဆုံး (congestion)"
          rows={charts.byChannel}
          colour="#7c3aed"
          height={300}
          width={100}
        />
        <ChartCard
          title="Hardware ထုတ်လုပ်သူ (OUI)"
          rows={charts.byVendor}
          colour="#ea580c"
          height={300}
          width={130}
        />
      </div>

      {/* Which client did the scanning */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Browser"
          rows={charts.byBrowser}
          colour="#2563eb"
          height={230}
          width={100}
        />
        <ChartCard
          title="OS / platform"
          rows={charts.byOs}
          colour="#16a34a"
          height={230}
          width={100}
        />
        <ChartCard
          title="App version"
          rows={charts.byApp}
          colour="#7c3aed"
          height={230}
          width={110}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">WPS ဖွင့်ထား (အားနည်း)</p>
            <p className="text-xl font-bold tabular-nums text-amber-600">
              {charts.wpsCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Hidden SSID</p>
            <p className="text-xl font-bold tabular-nums">
              {charts.hiddenCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Watchlist</p>
            <p className="text-xl font-bold tabular-nums text-red-600">
              {watchlist.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Cluster (AP ≥ 8)</p>
            <p className="text-xl font-bold tabular-nums">{clusters.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Dense clusters — leads, not findings. */}
      <Card className="border-amber-400">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            🔍 AP အထူးထူ နေရာများ (တစ်နေရာတွင် AP အများ)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <p className="border-b bg-amber-500/10 px-4 py-2 text-[11px] leading-relaxed">
            <strong>အရေးကြီး —</strong> ဤစာရင်းသည် <strong>သဲလွန်စသာ</strong>{" "}
            ဖြစ်ပြီး အထောက်အထား <strong>မဟုတ်ပါ</strong>။ တစ်နေရာတည်းမှာ AP
            အများအပြားရှိတာက ဟိုတယ်၊ ကုန်တိုက်၊ တက္ကသိုလ်၊ ရုံးအုပ်စု
            ဖြစ်နိုင်သလို ကျားဖျန်/scam compound လည်း ဖြစ်နိုင်သည်။ WiFi scan
            တစ်ခုတည်းနဲ့ အဆောက်အအုံတစ်ခုက ဘာလုပ်နေလဲ အတိအကျ မဆုံးဖြတ်နိုင်ပါ —
            တရားဝင်လုပ်ငန်းကို အထင်မှားစေခြင်း ကြီးမားသော ထိခိုက်မှုဖြစ်သည်။
            စစ်ဆေးပြီးမှ အောက်က watchlist တွင် မှတ်တမ်းတင်ပါ။
          </p>
          {clusters.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              AP ၈ ခုအထက် စုနေတဲ့ နေရာ မရှိသေးပါ။
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left">တည်နေရာ</th>
                    <th className="px-3 py-2 text-right">AP</th>
                    <th className="px-3 py-2 text-right">Hidden</th>
                    <th className="px-3 py-2 text-left">SSID နမူနာ</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-right">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {clusters.map((c) => (
                    <tr
                      key={`${c.latitude}|${c.longitude}`}
                      className="border-t"
                    >
                      <td className="px-3 py-1.5">
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {c.latitude.toFixed(3)}, {c.longitude.toFixed(3)}
                        </a>
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold tabular-nums">
                        {c.apCount}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {c.hiddenCount}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-1.5 text-xs">
                        {c.sampleSsids.join(", ") || "—"}
                        {c.commonPrefix ? (
                          <span className="ml-1 text-amber-600">
                            (prefix “{c.commonPrefix}”)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {c.topVendor ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs">
                        {c.flaggedCount > 0 ? (
                          <span className="font-semibold text-red-600">
                            {c.flaggedCount}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The watchlist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            🚩 Watchlist — admin မှတ်တမ်းတင်ထားသော network များ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {watchlist.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              မှတ်တမ်း မရှိသေးပါ — အောက်က AP ဇယားမှ “Flag” နှိပ်၍ မှတ်တမ်းတင်ပါ။
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left">Risk</th>
                    <th className="px-3 py-2 text-left">SSID / BSSID</th>
                    <th className="px-3 py-2 text-left">အမျိုးအစား</th>
                    <th className="px-3 py-2 text-left">မှတ်ချက်</th>
                    <th className="px-3 py-2 text-left">တည်နေရာ</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {watchlist.map((w) => (
                    <WatchRow key={w.bssid} row={w} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full AP table */}
      <Card>
        <CardHeader className="gap-2 pb-2">
          <CardTitle className="text-sm">
            Access point အားလုံး ({rows.length.toLocaleString("en-US")})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar
              value={filter}
              onValueChange={setFilter}
              placeholder="SSID / BSSID / vendor / encryption ရှာရန်…"
              containerClassName="max-w-sm flex-1"
            />
            <button
              type="button"
              onClick={() => setOnlyFlagged((v) => !v)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                onlyFlagged
                  ? "border-red-400 bg-red-500/10 text-red-600"
                  : "text-muted-foreground"
              }`}
            >
              🚩 Flagged only
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-2 text-left">SSID</th>
                  <th className="px-3 py-2 text-left">BSSID</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Encryption</th>
                  <th className="px-3 py-2 text-left">Band / ch</th>
                  <th className="px-3 py-2 text-right">Signal</th>
                  <th className="px-3 py-2 text-right">Scans</th>
                  <th className="px-3 py-2 text-left">တည်နေရာ</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <NetworkRow key={n.bssid} n={n} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WatchRow({ row }: { row: WatchlistRow }) {
  const [gone, setGone] = React.useState(false);
  if (gone) return null;
  return (
    <tr className="border-t">
      <td className="px-3 py-1.5">
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
            RISK_COLOUR[row.risk] ?? RISK_COLOUR.watch
          }`}
        >
          {row.risk}
        </span>
      </td>
      <td className="px-3 py-1.5">
        <p className="font-medium">{row.ssid || "(hidden)"}</p>
        <p className="text-[11px] text-muted-foreground">{row.bssid}</p>
      </td>
      <td className="px-3 py-1.5 text-xs">{row.category}</td>
      <td className="max-w-[260px] px-3 py-1.5 text-xs">{row.note}</td>
      <td className="px-3 py-1.5 text-xs">
        {row.latitude != null && row.longitude != null ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${row.latitude}&mlon=${row.longitude}#map=17/${row.latitude}/${row.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-1.5 text-right">
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`Remove ${row.bssid} from the watchlist?`)) return;
            const res = await fetch(
              `/api/admin/wifi-watchlist?bssid=${encodeURIComponent(row.bssid)}`,
              { method: "DELETE" },
            );
            if (res.ok) setGone(true);
          }}
          className="text-xs text-muted-foreground hover:text-red-600"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

function NetworkRow({ n }: { n: WifiNetworkRow }) {
  const [flag, setFlag] = React.useState(n.watch);
  const [busy, setBusy] = React.useState(false);

  async function doFlag() {
    const risk = window.prompt(
      "Risk — watch / suspect / confirmed / cleared",
      flag?.risk ?? "watch",
    );
    if (!risk) return;
    const category = window.prompt(
      "အမျိုးအစား — scam_compound / phishing_ap / unknown_cluster / other",
      flag?.category ?? "scam_compound",
    );
    if (!category) return;
    const note = window.prompt(
      "မှတ်ချက် (ဘာကြောင့် မှတ်တမ်းတင်လဲ — စစ်ဆေးရလဒ်၊ သတင်း၊ တိုင်ကြားချက်)",
      flag?.note ?? "",
    );
    if (!note || note.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/wifi-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bssid: n.bssid,
          risk: risk.trim(),
          category: category.trim(),
          note: note.trim(),
        }),
      });
      if (res.ok) {
        setFlag({ risk: risk.trim(), category: category.trim(), note: note.trim() });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={`border-t ${flag ? "bg-red-500/5" : ""}`}>
      <td className="max-w-[160px] truncate px-3 py-1.5 font-medium">
        {n.ssid || <span className="text-muted-foreground">(hidden)</span>}
        {flag ? (
          <span className="ml-1 text-[10px] font-bold text-red-600">
            🚩 {flag.risk}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
        {n.bssid}
      </td>
      <td className="px-3 py-1.5 text-xs">{n.vendor ?? "—"}</td>
      <td className="px-3 py-1.5 text-xs">
        <span
          className={
            n.encryption === "OPEN" ? "font-bold text-red-600" : undefined
          }
        >
          {n.encryption}
        </span>
        {n.wps ? <span className="ml-1 text-amber-600">WPS</span> : null}
      </td>
      <td className="px-3 py-1.5 text-xs">
        {n.band ?? "—"}
        {n.channel != null ? ` · ch ${n.channel}` : ""}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">
        {n.bestSignal != null ? `${n.bestSignal} dBm` : "—"}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">{n.observations}</td>
      <td className="px-3 py-1.5 text-xs">
        <a
          href={`https://www.openstreetmap.org/?mlat=${n.latitude}&mlon=${n.longitude}#map=18/${n.latitude}/${n.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {n.latitude.toFixed(4)}, {n.longitude.toFixed(4)}
        </a>
      </td>
      <td className="px-3 py-1.5 text-right">
        <button
          type="button"
          disabled={busy}
          onClick={() => void doFlag()}
          className="rounded-md border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-red-600 disabled:opacity-50"
        >
          {flag ? "Edit flag" : "Flag"}
        </button>
      </td>
    </tr>
  );
}
