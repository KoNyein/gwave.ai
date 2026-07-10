"use client";

import * as React from "react";
import Link from "next/link";
import { Cpu, Loader2, Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FarmShareButton } from "@/components/farm/farm-share-button";
import {
  formatMetric,
  metricLabel,
  metricUnit,
} from "@/components/farm/metrics";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Device, SensorReading } from "@/types/database";

interface SeriesPoint {
  value: number;
  ts: string;
}

interface FarmDashboardProps {
  sensors: Device[];
  initialLatest: Record<string, { value: number; ts: string }>;
  initialSeries: Record<string, SeriesPoint[]>;
  userId: string;
}

function seriesKey(deviceId: string, metric: string): string {
  return `${deviceId}:${metric}`;
}

function Sparkline({ points }: { points: SeriesPoint[] }) {
  if (points.length < 2) {
    return <div className="h-8" />;
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 30 - ((point.value - min) / span) * 26 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" preserveAspectRatio="none">
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
      />
    </svg>
  );
}

export function FarmDashboard({
  sensors,
  initialLatest,
  initialSeries,
  userId,
}: FarmDashboardProps) {
  const t = useTranslations("farm");
  const [latest, setLatest] = React.useState(initialLatest);
  const [series, setSeries] = React.useState(initialSeries);
  const [selected, setSelected] = React.useState<{
    device: Device;
    metric: string;
  } | null>(null);

  const sensorIds = React.useMemo(
    () => new Set(sensors.map((sensor) => sensor.id)),
    [sensors],
  );

  // Live updates: new readings stream in over realtime (RLS-scoped).
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`farm:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_readings" },
        (payload) => {
          const reading = payload.new as SensorReading;
          if (!sensorIds.has(reading.device_id)) return;
          const key = seriesKey(reading.device_id, reading.metric);
          const value = Number(reading.value);
          setLatest((previous) => ({
            ...previous,
            [key]: { value, ts: reading.ts },
          }));
          setSeries((previous) => ({
            ...previous,
            [key]: [...(previous[key] ?? []), { value, ts: reading.ts }].slice(
              -30,
            ),
          }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, sensorIds]);

  const zones = [...new Set(sensors.map((sensor) => sensor.zone))];

  if (sensors.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Cpu className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("noSensors")}</p>
          <Link
            href="/farm/devices"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("registerFirst")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <FarmShareButton sensors={sensors} latest={latest} />
      </div>
      {zones.map((zone) => (
        <section key={zone}>
          <h2 className="mb-2 px-1 text-sm font-semibold uppercase text-muted-foreground">
            {zone}
          </h2>
          <div className="space-y-3">
            {sensors
              .filter((sensor) => sensor.zone === zone)
              .map((sensor) => {
                const metrics = Object.keys(latest)
                  .filter((key) => key.startsWith(`${sensor.id}:`))
                  .map((key) => key.split(":")[1]!)
                  .sort();
                return (
                  <Card key={sensor.id}>
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="flex items-center gap-2 font-semibold">
                          {sensor.name}
                          {sensor.online ? (
                            <Wifi className="h-4 w-4 text-primary" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sensor.last_seen
                            ? t("lastSeen", {
                                time: timeAgo(sensor.last_seen),
                              })
                            : t("neverSeen")}
                        </p>
                      </div>
                      {metrics.length === 0 ? (
                        <p className="py-3 text-center text-sm text-muted-foreground">
                          {t("noData")}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                          {metrics.map((metric) => {
                            const key = seriesKey(sensor.id, metric);
                            const current = latest[key];
                            return (
                              <button
                                key={metric}
                                type="button"
                                onClick={() =>
                                  setSelected({ device: sensor, metric })
                                }
                                className="rounded-lg border p-2.5 text-left transition-colors hover:bg-muted"
                              >
                                <p className="text-xs text-muted-foreground">
                                  {metricLabel(metric)}
                                </p>
                                <p className="text-lg font-bold">
                                  {current
                                    ? formatMetric(metric, current.value)
                                    : "–"}
                                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                                    {metricUnit(metric)}
                                  </span>
                                </p>
                                <Sparkline points={series[key] ?? []} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </section>
      ))}

      {selected ? (
        <HistoryDialog
          device={selected.device}
          metric={selected.metric}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

const RANGES = ["24h", "7d", "30d"] as const;

function HistoryDialog({
  device,
  metric,
  onClose,
}: {
  device: Device;
  metric: string;
  onClose: () => void;
}) {
  const t = useTranslations("farm");
  const [range, setRange] = React.useState<(typeof RANGES)[number]>("24h");
  const [points, setPoints] = React.useState<SeriesPoint[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setPoints(null);
    fetch(
      `/api/farm/readings?device=${device.id}&metric=${encodeURIComponent(metric)}&range=${range}`,
    )
      .then((response) => response.json())
      .then((payload: { points?: SeriesPoint[] }) => {
        if (!cancelled) setPoints(payload.points ?? []);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [device.id, metric, range]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {device.name} — {metricLabel(metric)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                range === option
                  ? "border-primary bg-secondary font-semibold text-primary"
                  : "hover:bg-muted",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="h-72">
          {points === null ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : points.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(value: string) =>
                    range === "24h"
                      ? new Date(value).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : new Date(value).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })
                  }
                  fontSize={11}
                  minTickGap={32}
                />
                <YAxis
                  fontSize={11}
                  width={44}
                  domain={["auto", "auto"]}
                  tickFormatter={(value: number) =>
                    formatMetric(metric, value)
                  }
                />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value as string).toLocaleString()
                  }
                  formatter={(value) => [
                    `${formatMetric(metric, Number(value))} ${metricUnit(metric)}`,
                    metricLabel(metric),
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3B6D11"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
