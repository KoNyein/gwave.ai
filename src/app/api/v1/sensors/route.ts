import { NextRequest, NextResponse } from "next/server";

import { authenticateApiRequest, parseLimit } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/data/admin";

/**
 * GET /api/v1/sensors?device=&metric= — recent sensor readings from the
 * KEY OWNER's devices only. Scope: read:sensors.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, "read:sensors");
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data: devices } = await admin
    .from("devices")
    .select("id, name, zone, type")
    .eq("owner_id", auth.key.owner_id);
  const deviceIds = (devices ?? []).map((device) => device.id);

  if (deviceIds.length === 0) {
    await auth.log(200);
    return NextResponse.json({ data: [] });
  }

  let query = admin
    .from("sensor_readings")
    .select("device_id, metric, value, ts")
    .in("device_id", deviceIds)
    .order("ts", { ascending: false })
    .limit(parseLimit(request));

  const device = request.nextUrl.searchParams.get("device");
  if (device && deviceIds.includes(device)) {
    query = query.eq("device_id", device);
  }
  const metric = request.nextUrl.searchParams.get("metric");
  if (metric) query = query.eq("metric", metric);

  const { data, error } = await query;
  const status = error ? 500 : 200;
  await auth.log(status);
  if (error) {
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data, devices });
}
