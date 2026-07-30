"use client";

import * as React from "react";
import dynamic from "next/dynamic";
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

import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WifiOverview } from "@/lib/db/wifi-admin";
import type { WifiMapPoint } from "./wifi-map-inner";

// Leaflet touches window, so the coverage map is client-only.
const WifiMap = dynamic(() => import("./wifi-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
      Loading map…
    </div>
  ),
});

/** Colour a security label the way risk reads: open = red, WPA3 = green. */
function securityColour(label: string): string {
  const l = label.toUpperCase();
  if (l === "OPEN") return "#dc2626";
  if (l === "WEP") return "#ea580c";
  if (l === "WPA") return "#f0b429";
  if (l === "WPA2") return "#65a30d";
  if (l === "WPA3") return "#16a34a";
  return "#94a3b8";
}

function signalColour(label: string): string {
  if (label.startsWith("Excellent")) return "#16a34a";
  if (label.startsWith("Good")) return "#84cc16";
  if (label.startsWith("Fair")) return "#f0b429";
  if (label.startsWith("Weak")) return "#dc2626";
  return "#94a3b8";
}

export function WifiAnalytics({
  overview,
  points,
}: {
  overview: WifiOverview;
  points: WifiMapPoint[];
}) {
  const [openOnly, setOpenOnly] = React.useState(false);
  const shown = React.useMemo(
    () =>
      openOnly
        ? points.filter((p) => (p.security ?? "").toUpperCase() === "OPEN")
        : points,
    [openOnly, points],
  );

  const cards = [
    { label: "စုစုပေါင်း WiFi (AP)", value: overview.totalNetworks },
    { label: "Scan မှတ်တမ်း (၃၀ရက်)", value: overview.totalScans },
    { label: "ပါဝင်သူ user", value: overview.contributors },
    { label: "OPEN (မလုံခြုံ)", value: overview.openNetworks },
    { label: "ယနေ့ scan", value: overview.scansToday },
    { label: "၇ ရက်အတွင်း", value: overview.scans7d },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold tabular-nums">
                {c.value.toLocaleString("en-US")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Scan လုပ်မှု — ၃၀ ရက် (တစ်ရက်ချင်း)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.byDay}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
              <XAxis
                dataKey="day"
                fontSize={11}
                tickFormatter={(v: string) => v.slice(5)}
                minTickGap={16}
              />
              <YAxis fontSize={11} width={36} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">လုံခြုံရေးအလိုက် (AP)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.bySecurity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  fontSize={11}
                  width={70}
                />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {overview.bySecurity.map((r) => (
                    <Cell key={r.label} fill={securityColour(r.label)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Signal အားအလိုက် (dBm အုပ်စု)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.bySignal} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  fontSize={10}
                  width={110}
                />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {overview.bySignal.map((r) => (
                    <Cell key={r.label} fill={signalColour(r.label)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm">
            WiFi လွှမ်းခြုံမှု မြေပုံ ({shown.length.toLocaleString("en-US")})
          </CardTitle>
          <button
            type="button"
            onClick={() => setOpenOnly((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              openOnly
                ? "border-red-500 bg-red-500/10 text-red-600"
                : "text-muted-foreground"
            }`}
          >
            OPEN only ⚠
          </button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[60vh] w-full overflow-hidden rounded-b-xl">
            <WifiMap points={shown} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            User အလိုက် ပါဝင်မှု (scan အများဆုံး)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overview.topContributors.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              မှတ်တမ်း မရှိသေးပါ — user တစ်ဦး WiFi scan လုပ်ပြီးသည်နှင့်
              ဤနေရာတွင် ပေါ်လာမည်။ (db/sql/wifi-scan-log.sql ကို RDS တွင်
              run ထားရန် လိုအပ်သည်။)
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-right">Scan</th>
                    <th className="px-3 py-2 text-right">AP အမျိုးအစား</th>
                    <th className="px-3 py-2 text-right">အားအကောင်းဆုံး</th>
                    <th className="px-3 py-2 text-left">နောက်ဆုံး scan</th>
                    <th className="px-3 py-2 text-left">တည်နေရာ</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.topContributors.map((c) => (
                    <tr key={c.userId} className="border-t">
                      <td className="px-3 py-2">
                        <p className="font-medium">
                          {c.fullName || c.username || c.userId.slice(0, 8)}
                        </p>
                        {c.username ? (
                          <p className="text-xs text-muted-foreground">
                            @{c.username}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {c.scans.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.uniqueAps.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.strongest != null ? `${c.strongest} dBm` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(c.lastScanAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${c.lastLat}&mlon=${c.lastLng}#map=16/${c.lastLat}/${c.lastLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {c.lastLat.toFixed(4)}, {c.lastLng.toFixed(4)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        ဤအချက်အလက်များသည် user များ WiFi map တွင် scan လုပ်စဉ် စုစည်းရရှိသော
        crowdsourced data ဖြစ်သည် (WiGLE ပုံစံ)။ Admin သာ မြင်နိုင်ပါသည် —
        wifi_scans table သည် RLS ဖြင့် ပိတ်ထားပြီး server admin client မှသာ
        ဖတ်နိုင်သည်။
      </p>
    </div>
  );
}
