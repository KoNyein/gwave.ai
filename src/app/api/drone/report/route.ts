import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/drone/report — ingest drone detections from an external RF sensor.
 *
 * This is how an SDR receiver (RTL-SDR / HackRF running OpenDroneID or a DJI
 * DroneID decoder) or a dedicated counter-UAS RF detector feeds the networked
 * radar with signals a phone can't hear (OcuSync, ELRS, Crossfire…). The sensor
 * authenticates with the `x-sensor-key` header (env `DRONE_SENSOR_KEY`) and
 * POSTs one detection or an array of them. Rows auto-expire (default 5 min) so
 * the live feed reflects "right now".
 */
const detection = z.object({
  source: z.string().max(24).optional(),
  sensorId: z.string().max(64).optional(),
  protocol: z.string().max(48).optional(),
  vendor: z.string().max(48).optional(),
  label: z.string().max(120).optional(),
  rssi: z.number().int().min(-120).max(0).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  altitudeM: z.number().min(-500).max(20000).optional(),
  headingDeg: z.number().min(0).max(360).optional(),
  speedMs: z.number().min(0).max(400).optional(),
  remoteId: z.string().max(120).optional(),
  detectedAt: z.string().datetime().optional(),
  ttlSeconds: z.number().int().min(10).max(3600).optional(),
});
const schema = z.union([detection, z.array(detection).max(200)]);

export async function POST(request: NextRequest) {
  const key = process.env.DRONE_SENSOR_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Sensor ingest is not configured (DRONE_SENSOR_KEY unset)." },
      { status: 503 },
    );
  }
  if (request.headers.get("x-sensor-key") !== key) {
    return NextResponse.json({ error: "Invalid sensor key." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid detection payload." },
      { status: 400 },
    );
  }
  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  const now = Date.now();
  const rows = items.map((d) => ({
    source: d.source ?? "sensor",
    sensor_id: d.sensorId ?? null,
    protocol: d.protocol ?? null,
    vendor: d.vendor ?? null,
    label: d.label ?? null,
    rssi: d.rssi ?? null,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    altitude_m: d.altitudeM ?? null,
    heading_deg: d.headingDeg ?? null,
    speed_ms: d.speedMs ?? null,
    remote_id: d.remoteId ?? null,
    detected_at: d.detectedAt ?? new Date(now).toISOString(),
    expires_at: new Date(now + (d.ttlSeconds ?? 300) * 1000).toISOString(),
  }));

  // drone_detections isn't in the generated Database type (migrated directly on
  // RDS), so use a minimal insert view of the admin client.
  const sb = createAdminClient() as unknown as {
    from(table: string): {
      insert(values: unknown[]): PromiseLike<{ error: { message: string } | null }>;
    };
  };
  const { error } = await sb.from("drone_detections").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ingested: rows.length });
}
