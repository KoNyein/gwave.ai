import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { sendFcmToUser } from "@/lib/fcm";
import { rideCaller } from "@/lib/ride/auth";
import { announceRide, releaseDriver } from "@/lib/ride/dispatch";
import { cancellationFee, type FareTable } from "@/lib/ride/fare";
import { RIDE_COLUMNS, type RideRow } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cancel a ride. Either side may, and who did it is recorded — the database
 * refuses a cancellation that doesn't say.
 *
 * The fee is computed here, not sent by the client, and it is charged to the
 * rider only after a grace period following acceptance (see fare.ts). Charging
 * from the instant of acceptance punishes riders for a driver who accepted from
 * three kilometres away and then crawled; the grace window is what keeps the
 * fee defensible.
 *
 * A driver cancelling is free of charge but not free of consequence: it lands
 * in `cancelled_rides`, which is the number that shows a driver who accepts
 * everything and drives nothing.
 */

const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = cancelSchema.safeParse(await request.json().catch(() => ({})));
  const reason = parsed.success ? parsed.data.reason ?? null : null;

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
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }

  const by = isRider ? "rider" : isDriver ? "driver" : "admin";

  let fee = 0;
  if (by === "rider") {
    const { data: table } = await admin
      .from("ride_vehicle_types")
      .select("code, base_fare, per_km, per_min, min_fare, cancel_fee, commission_rate")
      .eq("code", ride.vehicle_type)
      .maybeSingle<FareTable>();
    if (table) fee = cancellationFee(table, ride.status, ride.accepted_at);
  }

  const { data: updated, error } = await admin
    .from("rides")
    .update({
      status: "cancelled",
      cancelled_by: by,
      cancel_reason: reason,
      cancel_fee: fee,
      // A cancelled ride never settles. Marking it 'waived' rather than
      // leaving it 'pending' keeps it out of the unsettled-rides queue that
      // support works through.
      payment_status: "waived",
    })
    .eq("id", id)
    .select(RIDE_COLUMNS)
    .single<RideRow>();
  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Could not cancel the ride." },
      { status: 409 },
    );
  }

  // Close any offer still sitting on a driver's screen, so nobody accepts a
  // ride that no longer exists.
  await admin
    .from("ride_offers")
    .update({ response: "cancelled", responded_at: new Date().toISOString() })
    .eq("ride_id", id)
    .eq("response", "pending");

  await releaseDriver(ride.driver_id);

  if (by === "driver" && ride.driver_id) {
    const { data: profile } = await admin
      .from("ride_driver_profiles")
      .select("cancelled_rides")
      .eq("user_id", ride.driver_id)
      .maybeSingle<{ cancelled_rides: number }>();
    await admin
      .from("ride_driver_profiles")
      .update({ cancelled_rides: (profile?.cancelled_rides ?? 0) + 1 })
      .eq("user_id", ride.driver_id);
  }

  await announceRide(updated, "ride_cancelled", { by, fee });

  const other = by === "rider" ? ride.driver_id : ride.rider_id;
  if (other) {
    await sendFcmToUser(other, {
      notification: {
        title: "Ride cancelled",
        body: by === "rider" ? "The passenger cancelled." : "The driver cancelled.",
      },
      data: { type: "ride_cancelled", rideId: id },
    }).catch(() => undefined);
  }

  return NextResponse.json({ ride: updated, fee });
}
