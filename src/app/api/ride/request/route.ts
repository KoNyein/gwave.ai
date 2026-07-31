import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { rideCaller } from "@/lib/ride/auth";
import { advanceDispatch, getSettings } from "@/lib/ride/dispatch";
import { quoteFare, surgeFor, type FareTable } from "@/lib/ride/fare";
import { routeBetween } from "@/lib/ride/routing";
import { RIDE_ACTIVE_STATUSES, RIDE_COLUMNS, RIDE_VEHICLE_TYPES, type RideRow } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Book a ride.
 *
 * The fare is recomputed here from the route and the current fare table. The
 * client sends what it was shown so we can refuse a stale quote, but it is
 * never the source of the price — a client-supplied fare is a client-chosen
 * fare.
 */

const requestSchema = z.object({
  vehicleType: z.enum(RIDE_VEHICLE_TYPES),
  pickup: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().trim().min(2).max(300),
  }),
  dropoff: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().trim().min(2).max(300),
  }),
  paymentMethod: z.enum(["cash", "gpay"]),
  note: z.string().trim().max(500).optional(),
  /** What the rider was quoted. Used only to detect drift, never to price. */
  expectedFare: z.number().min(0).optional(),
});

/**
 * How far the recomputed fare may drift from the quote before we stop and make
 * the rider look again. Prices move between the quote screen and the confirm
 * tap when surge changes; silently charging the new number is how an app earns
 * a reputation for lying.
 */
const FARE_DRIFT_TOLERANCE = 0.1;

export async function POST(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Pickup, dropoff, vehicle type and payment method are required." },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const settings = await getSettings();
  if (!settings.accepting_rides) {
    return NextResponse.json({ error: "Rides are paused right now." }, { status: 503 });
  }
  if (body.paymentMethod === "gpay" && !settings.platform_gpay_account) {
    return NextResponse.json(
      { error: "Wallet payment isn't available yet. Please choose cash." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  // One ride at a time. Without this a rider double-tapping Confirm books two
  // rides, two drivers come, and one of them is not getting paid.
  const { data: existing } = await admin
    .from("rides")
    .select("id, status")
    .eq("rider_id", me.id)
    .in("status", RIDE_ACTIVE_STATUSES)
    .limit(1)
    .returns<{ id: string; status: string }[]>();
  const inFlight = existing?.[0];
  if (inFlight) {
    return NextResponse.json(
      { error: "You already have a ride in progress.", rideId: inFlight.id },
      { status: 409 },
    );
  }

  const { data: table } = await admin
    .from("ride_vehicle_types")
    .select("code, base_fare, per_km, per_min, min_fare, cancel_fee, commission_rate")
    .eq("code", body.vehicleType)
    .eq("enabled", true)
    .maybeSingle<FareTable>();
  if (!table) {
    return NextResponse.json(
      { error: "That vehicle type isn't available." },
      { status: 400 },
    );
  }

  if (body.paymentMethod === "gpay") {
    const { data: wallet } = await admin
      .from("gpay_accounts")
      .select("balance, status")
      .eq("user_id", me.id)
      .maybeSingle<{ balance: number; status: string }>();
    if (!wallet || wallet.status !== "active") {
      return NextResponse.json(
        { error: "You need an active G-Pay account to pay by wallet." },
        { status: 400 },
      );
    }
  }

  const route = await routeBetween(body.pickup, body.dropoff);
  const { data: driversData } = await admin.rpc("ride_nearest_drivers", {
    p_lat: body.pickup.lat,
    p_lng: body.pickup.lng,
    p_vehicle_type: body.vehicleType,
    p_radius_m: settings.search_radius_m,
    p_limit: 50,
    p_stale_after_s: settings.driver_stale_after_s,
  });
  const drivers = (driversData as { driver_id: string }[] | null) ?? [];
  const { count: waiting } = await admin
    .from("rides")
    .select("id", { count: "exact", head: true })
    .eq("status", "requested")
    .eq("vehicle_type", body.vehicleType);

  const surge = surgeFor(waiting ?? 0, drivers.length);
  const quote = quoteFare(table, route.distanceM, route.durationS, surge);

  if (
    typeof body.expectedFare === "number" &&
    body.expectedFare > 0 &&
    Math.abs(quote.fare - body.expectedFare) / body.expectedFare > FARE_DRIFT_TOLERANCE
  ) {
    return NextResponse.json(
      {
        error: "The price changed while you were booking.",
        code: "fare_changed",
        fare: quote.fare,
        surge: quote.surge,
      },
      { status: 409 },
    );
  }

  const { data: ride, error } = await admin
    .from("rides")
    .insert({
      rider_id: me.id,
      vehicle_type: body.vehicleType,
      pickup_lat: body.pickup.lat,
      pickup_lng: body.pickup.lng,
      pickup_address: body.pickup.address,
      dropoff_lat: body.dropoff.lat,
      dropoff_lng: body.dropoff.lng,
      dropoff_address: body.dropoff.address,
      route_polyline: route.polyline,
      quoted_fare: quote.fare,
      quoted_distance_m: quote.distanceM,
      quoted_duration_s: quote.durationS,
      surge_multiplier: quote.surge,
      payment_method: body.paymentMethod,
      rider_note: body.note ?? null,
    })
    .select(RIDE_COLUMNS)
    .single<RideRow>();
  if (error || !ride) {
    console.warn("[ride/request] insert failed", error?.message);
    return NextResponse.json({ error: "Could not book the ride." }, { status: 500 });
  }

  // Ring the first driver before responding, so the rider's app opens the
  // searching screen with a driver already deciding rather than waiting a poll
  // interval for anything to happen.
  await advanceDispatch(ride);

  return NextResponse.json({ ride }, { status: 201 });
}
