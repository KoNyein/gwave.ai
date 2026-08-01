import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { rideCaller } from "@/lib/ride/auth";
import { getSettings } from "@/lib/ride/dispatch";
import { quoteFare, surgeFor, type FareTable } from "@/lib/ride/fare";
import { routeBetween } from "@/lib/ride/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Price a trip for every vehicle type at once.
 *
 * One route call, four fares — the rider picks a vehicle after seeing what each
 * costs, which is the whole interaction. Pricing each type with its own request
 * would mean four Directions calls for one screen, and on a paid provider that
 * is four times the bill for the same information.
 *
 * The quote is not binding until /api/ride/request stores it. It is, however,
 * the number the rider agreed to: request re-derives the fare from the same
 * inputs rather than trusting whatever the client posts back.
 */

const quoteSchema = z.object({
  pickup: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  dropoff: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export async function POST(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = quoteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Pickup and dropoff coordinates are required." },
      { status: 400 },
    );
  }
  const { pickup, dropoff } = parsed.data;

  const admin = createAdminClient();
  const { data: types, error } = await admin
    .from("ride_vehicle_types")
    .select(
      "code, label_en, label_my, sort_order, capacity, base_fare, per_km, per_min, min_fare, cancel_fee, commission_rate",
    )
    .eq("enabled", true)
    .order("sort_order")
    .returns<(FareTable & { label_en: string; label_my: string; capacity: number })[]>();
  if (error || !types?.length) {
    return NextResponse.json(
      { error: "Ride pricing is not configured yet." },
      { status: 503 },
    );
  }

  const settings = await getSettings();
  if (!settings.accepting_rides) {
    return NextResponse.json(
      { error: "Rides are paused right now." },
      { status: 503 },
    );
  }

  const route = await routeBetween(pickup, dropoff);

  // Surge is measured per vehicle type: bikes can be scarce while cars are
  // idle, and one blended multiplier would overprice the plentiful one.
  const options = await Promise.all(
    types.map(async (t) => {
      const surge = await surgeForType(t.code, pickup, settings.search_radius_m);
      const quote = quoteFare(t, route.distanceM, route.durationS, surge);
      return {
        vehicleType: t.code,
        labelEn: t.label_en,
        labelMy: t.label_my,
        capacity: t.capacity,
        fare: quote.fare,
        fareBeforeSurge: quote.baseFare,
        surge: quote.surge,
      };
    }),
  );

  return NextResponse.json({
    distanceM: route.distanceM,
    durationS: route.durationS,
    polyline: route.polyline,
    routeSource: route.source,
    options,
  });
}

/** Waiting riders versus idle drivers of this type, near this pickup. */
async function surgeForType(
  vehicleType: string,
  pickup: { lat: number; lng: number },
  radiusM: number,
): Promise<number> {
  const admin = createAdminClient();
  const { data: driversData } = await admin.rpc("ride_nearest_drivers", {
    p_lat: pickup.lat,
    p_lng: pickup.lng,
    p_vehicle_type: vehicleType,
    p_radius_m: radiusM,
    p_limit: 50,
  });
  const drivers = (driversData as { driver_id: string }[] | null) ?? [];

  // Rides still hunting for a driver of this type. Not geofenced — at the
  // volumes where surge matters at all, the whole city is one market, and a
  // bounding box here would need its own index for no extra accuracy.
  const { count } = await admin
    .from("rides")
    .select("id", { count: "exact", head: true })
    .eq("status", "requested")
    .eq("vehicle_type", vehicleType);

  return surgeFor(count ?? 0, drivers.length);
}
