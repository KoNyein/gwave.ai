import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const RANGES: Record<string, { hours: number; buckets: number }> = {
  "24h": { hours: 24, buckets: 96 },
  "7d": { hours: 24 * 7, buckets: 168 },
  "30d": { hours: 24 * 30, buckets: 180 },
};

/**
 * GET /api/farm/readings?device=&metric=&range=24h|7d|30d
 * Time-bucketed averages for the history charts. RLS scopes to the owner.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const deviceId = params.get("device");
  const metric = params.get("metric");
  const range = RANGES[params.get("range") ?? "24h"] ?? RANGES["24h"]!;
  if (!deviceId || !metric) {
    return NextResponse.json(
      { error: "Missing device or metric" },
      { status: 400 },
    );
  }

  const since = new Date(Date.now() - range.hours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("sensor_readings")
    .select("value, ts")
    .eq("device_id", deviceId)
    .eq("metric", metric)
    .gte("ts", since)
    .order("ts", { ascending: true })
    .limit(10000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Average into fixed buckets so the chart stays light.
  const start = Date.now() - range.hours * 3600_000;
  const bucketMs = (range.hours * 3600_000) / range.buckets;
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const row of data ?? []) {
    const index = Math.min(
      range.buckets - 1,
      Math.floor((new Date(row.ts).getTime() - start) / bucketMs),
    );
    const bucket = buckets.get(index) ?? { sum: 0, count: 0 };
    bucket.sum += Number(row.value);
    bucket.count += 1;
    buckets.set(index, bucket);
  }

  const points = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, bucket]) => ({
      ts: new Date(start + index * bucketMs).toISOString(),
      value: Number((bucket.sum / bucket.count).toFixed(3)),
    }));

  return NextResponse.json({ points });
}
