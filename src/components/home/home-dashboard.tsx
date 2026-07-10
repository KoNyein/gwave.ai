import { Cpu, Gauge, Power, Wand2, Wifi, WifiOff } from "lucide-react";

import { formatMetric, metricLabel, metricUnit } from "@/components/farm/metrics";
import { Card, CardContent } from "@/components/ui/card";
import type { LatestReading } from "@/lib/db/iot";
import type { Device } from "@/types/database";

function isOn(device: Device): boolean {
  return (device.state as { power?: string }).power === "on";
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * A snapshot overview of the smart home: device counts, how many switches are
 * on, who's online, active scenes, and the latest sensor readings. Static at
 * load — the interactive controls below keep live state.
 */
export function HomeDashboard({
  devices,
  scenesCount,
  readings,
}: {
  devices: Device[];
  scenesCount: number;
  readings: LatestReading[];
}) {
  const switches = devices.filter((d) => d.type === "switch");
  const on = switches.filter(isOn).length;
  const online = devices.filter((d) => d.online).length;
  const offline = devices.length - online;
  const sensors = devices.filter((d) => d.type === "sensor");

  const ownIds = new Set(devices.map((d) => d.id));
  const byDevice = new Map<string, LatestReading[]>();
  for (const r of readings) {
    if (!ownIds.has(r.device_id)) continue;
    const list = byDevice.get(r.device_id) ?? [];
    list.push(r);
    byDevice.set(r.device_id, list);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="စက်ပစ္စည်း"
          value={String(devices.length)}
          hint={`${sensors.length} sensor · ${switches.length} switch`}
        />
        <Stat
          icon={<Power className="h-3.5 w-3.5" />}
          label="ဖွင့်ထား"
          value={`${on}/${switches.length}`}
          hint="switch များ"
        />
        <Stat
          icon={
            offline > 0 ? (
              <WifiOff className="h-3.5 w-3.5" />
            ) : (
              <Wifi className="h-3.5 w-3.5" />
            )
          }
          label="Online"
          value={`${online}/${devices.length}`}
          hint={offline > 0 ? `${offline} offline` : "အားလုံး ချိတ်ဆက်ထား"}
        />
        <Stat
          icon={<Wand2 className="h-3.5 w-3.5" />}
          label="Scene"
          value={String(scenesCount)}
        />
      </div>

      {sensors.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Gauge className="h-4 w-4 text-primary" /> Sensor အခြေအနေ
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {sensors.flatMap((device) =>
                (byDevice.get(device.id) ?? []).map((r) => (
                  <div
                    key={`${device.id}:${r.metric}`}
                    className="rounded-lg border p-2.5"
                  >
                    <p className="truncate text-[11px] text-muted-foreground">
                      {device.name} · {metricLabel(r.metric)}
                    </p>
                    <p className="text-lg font-bold">
                      {formatMetric(r.metric, r.value)}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                        {metricUnit(r.metric)}
                      </span>
                    </p>
                  </div>
                )),
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
