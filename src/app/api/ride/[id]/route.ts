import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { rideCaller } from "@/lib/ride/auth";
import { advanceDispatch } from "@/lib/ride/dispatch";
import { RIDE_COLUMNS, type RideRow } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One ride, for the two people in it.
 *
 * This is also where dispatch is driven. The rider's app polls this while the
 * search runs, and each poll advances the offer loop by at most one step — see
 * the note at the top of lib/ride/dispatch.ts for why the waiting rider makes a
 * better clock than a background worker.
 *
 * Contact details are released only once a driver has accepted. Before that,
 * publishing a phone number would mean any rider could harvest driver numbers
 * by requesting and cancelling rides.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select(RIDE_COLUMNS)
    .eq("id", id)
    .maybeSingle<RideRow>();
  if (!ride) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }

  const isRider = ride.rider_id === me.id;
  const isDriver = ride.driver_id === me.id;
  if (!isRider && !isDriver && !me.isAdmin) {
    // 404 rather than 403: a stranger should not be able to confirm that a
    // given ride id exists.
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }

  // Only the rider's own poll should move the search along. A driver refreshing
  // their screen, or an admin watching the board, must not time out an offer
  // that is still in front of somebody.
  let current = ride;
  if (isRider && ride.status === "requested") {
    const changed = await advanceDispatch(ride);
    if (changed) {
      const { data: fresh } = await admin
        .from("rides")
        .select(RIDE_COLUMNS)
        .eq("id", id)
        .maybeSingle<RideRow>();
      if (fresh) current = fresh;
    }
  }

  const counterpart = await counterpartFor(current, isRider);
  return NextResponse.json({ ride: current, counterpart });
}

interface Counterpart {
  id: string;
  name: string | null;
  avatar: string | null;
  phone?: string;
  plate?: string;
  vehicle?: string;
  rating?: number | null;
  trips?: number;
}

/**
 * Who the caller is riding with — the driver's card for a rider, the rider's
 * name for a driver. Flat queries, assembled here: a PostgREST embed on this
 * path dies silently whenever the schema cache goes stale, and this path runs
 * every couple of seconds for the length of every trip.
 */
async function counterpartFor(
  ride: RideRow,
  viewerIsRider: boolean,
): Promise<Counterpart | null> {
  const otherId = viewerIsRider ? ride.driver_id : ride.rider_id;
  if (!otherId) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .eq("id", otherId)
    .maybeSingle<{
      id: string;
      full_name: string | null;
      username: string | null;
      avatar_url: string | null;
    }>();

  const base: Counterpart = {
    id: otherId,
    name: profile?.full_name ?? profile?.username ?? null,
    avatar: profile?.avatar_url ?? null,
  };
  if (!viewerIsRider) return base;

  const { data: driver } = await admin
    .from("ride_driver_profiles")
    .select(
      "phone, plate_number, vehicle_make, vehicle_model, vehicle_color, rating_sum, rating_count, completed_rides",
    )
    .eq("user_id", otherId)
    .maybeSingle<{
      phone: string;
      plate_number: string;
      vehicle_make: string | null;
      vehicle_model: string | null;
      vehicle_color: string | null;
      rating_sum: number;
      rating_count: number;
      completed_rides: number;
    }>();
  if (!driver) return base;

  return {
    ...base,
    phone: driver.phone,
    plate: driver.plate_number,
    vehicle: [driver.vehicle_color, driver.vehicle_make, driver.vehicle_model]
      .filter(Boolean)
      .join(" ") || undefined,
    rating:
      driver.rating_count > 0
        ? Math.round((driver.rating_sum / driver.rating_count) * 10) / 10
        : null,
    trips: driver.completed_rides,
  };
}
