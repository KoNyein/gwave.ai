import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { sendFcmToUser } from "@/lib/fcm";
import { approvedDriver, rideCaller } from "@/lib/ride/auth";
import { announceRide, releaseDriver } from "@/lib/ride/dispatch";
import { quoteFare, type FareTable } from "@/lib/ride/fare";
import { RIDE_COLUMNS, type RideRow } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The driver moving a trip forward: arrived → started → completed.
 *
 * The legality of each move is the database's job (the trigger on `rides`), so
 * this route only checks *who* is asking and supplies the numbers that go with
 * the move. That split matters: if this handler were the only guard, any other
 * writer — a future admin tool, a migration, a bug — could skip a step.
 */

const statusSchema = z.object({
  status: z.enum(["arrived", "in_progress", "completed"]),
  /** Metres actually driven, from the driver app's GPS track. */
  distanceM: z.number().min(0).max(1_000_000).optional(),
  durationS: z.number().min(0).max(86_400).optional(),
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
  const driver = await approvedDriver(me.id);
  if (!driver) {
    return NextResponse.json({ error: "Drivers only." }, { status: 403 });
  }

  const parsed = statusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }
  const { status } = parsed.data;

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select(RIDE_COLUMNS)
    .eq("id", id)
    .maybeSingle<RideRow>();
  if (!ride || ride.driver_id !== me.id) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }

  const patch: Record<string, unknown> = { status };

  if (status === "completed") {
    // Bill the distance actually driven when the app reports it, but never
    // less than the quote: a rider agreed to a price, and a GPS track that
    // came up short (tunnels, a cold fix, a phone that slept) must not be
    // allowed to quietly reprice the trip downward either. The quote is the
    // floor and the measured trip is the ceiling.
    const distanceM = Math.max(
      parsed.data.distanceM ?? ride.quoted_distance_m,
      ride.quoted_distance_m,
    );
    const durationS = Math.max(
      parsed.data.durationS ?? ride.quoted_duration_s,
      ride.quoted_duration_s,
    );

    const { data: table } = await admin
      .from("ride_vehicle_types")
      .select("code, base_fare, per_km, per_min, min_fare, cancel_fee, commission_rate")
      .eq("code", ride.vehicle_type)
      .maybeSingle<FareTable>();

    const finalFare = table
      ? quoteFare(table, distanceM, durationS, ride.surge_multiplier).fare
      : ride.quoted_fare;

    patch.final_fare = finalFare;
    patch.actual_distance_m = distanceM;
    patch.actual_duration_s = durationS;
  }

  const { data: updated, error } = await admin
    .from("rides")
    .update(patch)
    .eq("id", id)
    .eq("driver_id", me.id)
    .select(RIDE_COLUMNS)
    .single<RideRow>();
  if (error || !updated) {
    // The trigger rejects illegal moves with its own message; pass it through
    // so the driver app can say something specific instead of "failed".
    return NextResponse.json(
      { error: error?.message ?? "Could not update the ride." },
      { status: 409 },
    );
  }

  if (status === "completed") {
    await settle(updated);
    await releaseDriver(me.id);
  }

  await announceRide(updated, `ride_${status}`, {
    finalFare: updated.final_fare,
    paymentStatus: updated.payment_status,
  });
  await notifyRider(updated, status);

  return NextResponse.json({ ride: updated });
}

/**
 * Move the money.
 *
 * A settlement failure does NOT fail the request. The trip physically happened
 * and the driver is standing there; refusing to complete it because a wallet
 * was short would strand both of them. The ride completes, `payment_status`
 * records the failure with its reason, and the unsettled-rides index gives
 * support a queue to work through.
 */
async function settle(ride: RideRow): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("ride_settle", { p_ride: ride.id });
  if (!error) return;
  console.warn(`[ride/settle] ${ride.id} failed`, error.message);
  await admin
    .from("rides")
    .update({ payment_status: "failed", payment_error: error.message.slice(0, 300) })
    .eq("id", ride.id);
}

async function notifyRider(ride: RideRow, status: string): Promise<void> {
  const text: Record<string, { title: string; body: string }> = {
    arrived: { title: "Your driver is here", body: "Your driver is waiting at the pickup point." },
    in_progress: { title: "Trip started", body: "You're on your way." },
    completed: {
      title: "Trip completed",
      body: `Fare: ${ride.final_fare?.toLocaleString() ?? ""} MMK`,
    },
  };
  const message = text[status];
  if (!message) return;
  await sendFcmToUser(ride.rider_id, {
    notification: message,
    data: { type: `ride_${status}`, rideId: ride.id },
  }).catch(() => undefined);
}
