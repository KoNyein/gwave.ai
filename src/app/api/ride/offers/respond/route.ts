import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { sendFcmToUser } from "@/lib/fcm";
import { approvedDriver, rideCaller } from "@/lib/ride/auth";
import { announceRide } from "@/lib/ride/dispatch";
import { RIDE_COLUMNS, type RideRow } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A driver answers an offer.
 *
 * Accepting goes through `ride_accept_offer()` rather than a read-then-update
 * here, because two drivers tapping Accept in the same second is routine — it
 * happens every time dispatch widens to a second driver just as the first
 * replies. The function serialises them on the ride row so exactly one wins,
 * and the loser gets told they lost instead of driving to a pickup that isn't
 * theirs.
 */

const respondSchema = z.object({
  rideId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
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

  const parsed = respondSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ride and action are required." }, { status: 400 });
  }
  const { rideId, action } = parsed.data;
  const admin = createAdminClient();

  if (action === "decline") {
    await admin
      .from("ride_offers")
      .update({ response: "declined", responded_at: new Date().toISOString() })
      .eq("ride_id", rideId)
      .eq("driver_id", me.id)
      .eq("response", "pending");
    // Dispatch moves on at the next poll from the rider, who is still watching
    // their search screen — no need to make the declining driver wait for it.
    return NextResponse.json({ ok: true });
  }

  const { data: won, error } = await admin
    .rpc("ride_accept_offer", { p_ride: rideId, p_driver: me.id })
    .returns<boolean>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (!won) {
    return NextResponse.json(
      { error: "Another driver took this ride.", code: "lost_race" },
      { status: 409 },
    );
  }

  const { data: ride } = await admin
    .from("rides")
    .select(RIDE_COLUMNS)
    .eq("id", rideId)
    .maybeSingle<RideRow>();
  if (!ride) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }

  await announceRide(ride, "ride_accepted", {
    driverId: me.id,
    plate: driver.plate_number,
  });
  await sendFcmToUser(ride.rider_id, {
    notification: {
      title: "Driver on the way",
      body: `${driver.plate_number} is coming to pick you up.`,
    },
    data: { type: "ride_accepted", rideId },
  }).catch(() => undefined);

  return NextResponse.json({ ride });
}
