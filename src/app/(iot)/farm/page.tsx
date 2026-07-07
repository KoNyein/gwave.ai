import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FarmDashboard } from "@/components/farm/farm-dashboard";
import { getCurrentProfile } from "@/lib/auth";
import { getDevices, getLatestReadings } from "@/lib/db/iot";
import { createClient } from "@/lib/supabase/server";

export default async function FarmPage() {
  const t = await getTranslations("farm");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [devices, latest] = await Promise.all([
    getDevices(profile.id),
    getLatestReadings(),
  ]);
  const sensors = devices.filter(
    (device) => device.type === "sensor" || device.type === "controller",
  );

  // One query for sparkline history, grouped per device+metric.
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("sensor_readings")
    .select("device_id, metric, value, ts")
    .in(
      "device_id",
      sensors.map((sensor) => sensor.id),
    )
    .order("ts", { ascending: false })
    .limit(1000);

  const initialSeries: Record<string, { value: number; ts: string }[]> = {};
  for (const row of (recent ?? []).reverse()) {
    const key = `${row.device_id}:${row.metric}`;
    (initialSeries[key] ??= []).push({
      value: Number(row.value),
      ts: row.ts,
    });
  }
  for (const key of Object.keys(initialSeries)) {
    initialSeries[key] = initialSeries[key]!.slice(-30);
  }

  const initialLatest: Record<string, { value: number; ts: string }> = {};
  for (const reading of latest) {
    initialLatest[`${reading.device_id}:${reading.metric}`] = {
      value: reading.value,
      ts: reading.ts,
    };
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("title")}</h1>
      <FarmDashboard
        sensors={sensors}
        initialLatest={initialLatest}
        initialSeries={initialSeries}
        userId={profile.id}
      />
    </div>
  );
}
