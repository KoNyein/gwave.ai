import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Follow a shared trip. No account, no session — the token is the credential.
 *
 * What this returns is deliberately narrow, and the narrowness is the feature:
 *
 *   in    — status, pickup and dropoff coordinates and labels, the driver's
 *           first name, vehicle and plate, the driver's live position
 *   out   — the rider's name or id, either party's phone number, the fare, the
 *           payment method, the ride id
 *
 * A worried parent needs to see where the car is and which car it is. They do
 * not need their adult child's payment method, and whoever else the link was
 * forwarded to certainly does not. The plate is included precisely because it
 * is the thing you would read out to the police.
 *
 * Once the trip ends the link keeps working for a short while — a follower who
 * opens it a minute late should see "arrived safely", not a 404 that reads as
 * something having gone wrong — and then stops.
 */

/** How long after a trip ends the link keeps answering. */
const GRACE_MS = 30 * 60 * 1000;

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ token: string }> },
) {
  const { token } = await props.params;
  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select(
      "id, driver_id, status, vehicle_type, pickup_lat, pickup_lng, pickup_address, " +
        "dropoff_lat, dropoff_lng, dropoff_address, requested_at, accepted_at, " +
        "started_at, completed_at, cancelled_at",
    )
    .eq("share_token", token)
    .maybeSingle<{
      id: string;
      driver_id: string | null;
      status: string;
      vehicle_type: string;
      pickup_lat: number;
      pickup_lng: number;
      pickup_address: string;
      dropoff_lat: number;
      dropoff_lng: number;
      dropoff_address: string;
      requested_at: string;
      accepted_at: string | null;
      started_at: string | null;
      completed_at: string | null;
      cancelled_at: string | null;
    }>();

  if (!ride) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ended = ride.completed_at ?? ride.cancelled_at;
  if (ended && Date.now() - new Date(ended).getTime() > GRACE_MS) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  let driver: {
    name: string | null;
    plate: string | null;
    vehicle: string | null;
    lat: number | null;
    lng: number | null;
    heading: number | null;
    at: string | null;
  } | null = null;

  if (ride.driver_id) {
    const [{ data: profile }, { data: card }, { data: pos }] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name, username")
        .eq("id", ride.driver_id)
        .maybeSingle<{ full_name: string | null; username: string | null }>(),
      admin
        .from("ride_driver_profiles")
        .select("plate_number, vehicle_make, vehicle_model, vehicle_color")
        .eq("user_id", ride.driver_id)
        .maybeSingle<{
          plate_number: string;
          vehicle_make: string | null;
          vehicle_model: string | null;
          vehicle_color: string | null;
        }>(),
      admin
        .from("ride_driver_locations")
        .select("latitude, longitude, heading, updated_at")
        .eq("driver_id", ride.driver_id)
        .maybeSingle<{
          latitude: number;
          longitude: number;
          heading: number | null;
          updated_at: string;
        }>(),
    ]);

    // First name only. A follower needs to recognise the driver, not to be able
    // to look them up.
    const full = profile?.full_name ?? profile?.username ?? null;
    driver = {
      name: full ? full.split(" ")[0] ?? full : null,
      plate: card?.plate_number ?? null,
      vehicle:
        [card?.vehicle_color, card?.vehicle_make, card?.vehicle_model]
          .filter(Boolean)
          .join(" ") || null,
      // The car's position stops being published the moment the trip ends.
      lat: ended ? null : pos?.latitude ?? null,
      lng: ended ? null : pos?.longitude ?? null,
      heading: ended ? null : pos?.heading ?? null,
      at: ended ? null : pos?.updated_at ?? null,
    };
  }

  return NextResponse.json({
    status: ride.status,
    vehicleType: ride.vehicle_type,
    pickup: {
      lat: ride.pickup_lat,
      lng: ride.pickup_lng,
      address: ride.pickup_address,
    },
    dropoff: {
      lat: ride.dropoff_lat,
      lng: ride.dropoff_lng,
      address: ride.dropoff_address,
    },
    startedAt: ride.started_at,
    endedAt: ended,
    driver,
  });
}
