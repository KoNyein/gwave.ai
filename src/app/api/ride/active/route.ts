import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { approvedDriver, rideCaller } from "@/lib/ride/auth";
import {
  RIDE_ACTIVE_STATUSES,
  RIDE_COLUMNS,
  type RideRow,
} from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "What am I in the middle of?" — called on app start and on resume.
 *
 * Without this, a driver whose app was killed halfway through a trip reopens it
 * to an idle home screen while a passenger sits in their car, and the ride can
 * only be finished by someone in support. It answers for both roles because one
 * person can be both: an off-shift driver takes rides like anyone else.
 *
 * Also returns any offer still on the table, so a driver who reopens the app
 * during the ring window sees it rather than missing the fare.
 */
export async function GET(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: asRider } = await admin
    .from("rides")
    .select(RIDE_COLUMNS)
    .eq("rider_id", me.id)
    .in("status", RIDE_ACTIVE_STATUSES)
    .order("requested_at", { ascending: false })
    .limit(1)
    .returns<RideRow[]>();

  const driver = await approvedDriver(me.id);
  let asDriver: RideRow | null = null;
  let pendingOffer: {
    rideId: string;
    expiresAt: string;
    distanceM: number;
  } | null = null;

  if (driver) {
    const { data: driving } = await admin
      .from("rides")
      .select(RIDE_COLUMNS)
      .eq("driver_id", me.id)
      .in("status", RIDE_ACTIVE_STATUSES)
      .order("requested_at", { ascending: false })
      .limit(1)
      .returns<RideRow[]>();
    asDriver = driving?.[0] ?? null;

    if (!asDriver) {
      const { data: offers } = await admin
        .from("ride_offers")
        .select("ride_id, expires_at, distance_m")
        .eq("driver_id", me.id)
        .eq("response", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("sent_at", { ascending: false })
        .limit(1)
        .returns<{ ride_id: string; expires_at: string; distance_m: number }[]>();
      const offer = offers?.[0];
      if (offer) {
        pendingOffer = {
          rideId: offer.ride_id,
          expiresAt: offer.expires_at,
          distanceM: offer.distance_m,
        };
      }
    }
  }

  const { data: location } = driver
    ? await admin
        .from("ride_driver_locations")
        .select("is_online, is_available")
        .eq("driver_id", me.id)
        .maybeSingle<{ is_online: boolean; is_available: boolean }>()
    : { data: null };

  return NextResponse.json({
    asRider: asRider?.[0] ?? null,
    asDriver,
    pendingOffer,
    driver: driver
      ? {
          vehicleType: driver.vehicle_type,
          plate: driver.plate_number,
          online: location?.is_online ?? false,
          available: location?.is_available ?? false,
          completedRides: driver.completed_rides,
          rating:
            driver.rating_count > 0
              ? Math.round((driver.rating_sum / driver.rating_count) * 10) / 10
              : null,
        }
      : null,
  });
}
