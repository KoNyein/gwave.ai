import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { serverBroadcast } from "@/lib/realtime-server";
import { approvedDriver, rideCaller } from "@/lib/ride/auth";
import { RIDE_ACTIVE_STATUSES } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The driver's position, every few seconds while Driver Mode is on.
 *
 * This is the highest-frequency write in the whole product, so it does the
 * least work of any route here: one upsert into a single-row-per-driver table
 * (a HOT update, see the fillfactor note in the schema) and one broadcast. No
 * history table — a position from forty seconds ago has no reader, and storing
 * every one of them would be the single largest table in the database inside a
 * month, for nothing.
 *
 * The live position is pushed over Realtime rather than polled, so the rider's
 * map moves smoothly without either side paying for a request per tick.
 */

const beatSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(200).optional(),
  accuracy: z.number().min(0).max(10_000).optional(),
  batteryPct: z.number().min(0).max(100).optional(),
  /** Driver Mode switch. Omit to leave it as it is. */
  online: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const driver = await approvedDriver(me.id);
  if (!driver) {
    return NextResponse.json({ error: "Drivers only." }, { status: 403 });
  }

  const parsed = beatSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid position is required." }, { status: 400 });
  }
  const b = parsed.data;

  const admin = createAdminClient();

  // A driver mid-trip is online but not available. Deriving that here rather
  // than trusting the client means a stale app cannot put itself back in the
  // dispatch pool while it still has a passenger aboard.
  const { data: active } = await admin
    .from("rides")
    .select("id, status, rider_id")
    .eq("driver_id", me.id)
    .in("status", RIDE_ACTIVE_STATUSES)
    .limit(1)
    .returns<{ id: string; status: string; rider_id: string }[]>();
  const activeRide = active?.[0] ?? null;

  const row: Record<string, unknown> = {
    driver_id: me.id,
    latitude: b.lat,
    longitude: b.lng,
    heading: b.heading ?? null,
    speed: b.speed ?? null,
    accuracy: b.accuracy ?? null,
    battery_pct: b.batteryPct ?? null,
    vehicle_type: driver.vehicle_type,
    updated_at: new Date().toISOString(),
  };
  if (b.online !== undefined) {
    row.is_online = b.online;
    row.is_available = b.online && !activeRide;
  } else if (activeRide) {
    row.is_available = false;
  }

  const { error } = await admin
    .from("ride_driver_locations")
    .upsert(row, { onConflict: "driver_id" });
  if (error) {
    console.warn("[ride/heartbeat] upsert failed", error.message);
    return NextResponse.json({ error: "Could not record position." }, { status: 500 });
  }

  // Only push the position to someone who is actually watching it. Broadcasting
  // an idle driver's location to nobody is pure cost, and it is also a privacy
  // question: a driver's position is the rider's business only while that rider
  // is in their car or waiting for it.
  if (activeRide) {
    await serverBroadcast(`ride:${activeRide.id}`, "driver_position", {
      rideId: activeRide.id,
      lat: b.lat,
      lng: b.lng,
      heading: b.heading ?? null,
      speed: b.speed ?? null,
      at: row.updated_at,
    });
  }

  return NextResponse.json({
    ok: true,
    online: b.online ?? undefined,
    activeRideId: activeRide?.id ?? null,
  });
}
