import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { rideCaller } from "@/lib/ride/auth";
import { RIDE_COLUMNS, type RideRow } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rate the other party, once, after the trip.
 *
 * The rider's rating goes through `ride_apply_rating()` so the star and the
 * driver's rolling average move in one transaction — computing an average by
 * scanning `rides` would get slower with every trip a good driver completes,
 * which is exactly the wrong direction.
 *
 * "Once" is enforced by the ride's own `rider_rating` still being null, not by
 * a check here: a second tap while the first request is in flight would pass
 * any check this route could make.
 */

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
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

  const parsed = rateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "A rating of 1-5 is required." }, { status: 400 });
  }
  const { rating, comment } = parsed.data;

  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select(RIDE_COLUMNS)
    .eq("id", id)
    .maybeSingle<RideRow>();
  if (!ride || ride.status !== "completed") {
    return NextResponse.json(
      { error: "Only a completed ride can be rated." },
      { status: 404 },
    );
  }

  if (ride.rider_id === me.id) {
    const { error } = await admin.rpc("ride_apply_rating", {
      p_ride: id,
      p_rating: rating,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (comment) {
      await admin.from("rides").update({ rider_comment: comment }).eq("id", id);
    }
    return NextResponse.json({ ok: true });
  }

  if (ride.driver_id === me.id) {
    // The driver rating the rider. No aggregate to maintain — riders don't
    // have a public score — so a plain conditional update is enough, and the
    // `is null` filter is what makes it once-only.
    const { data, error } = await admin
      .from("rides")
      .update({ driver_rating: rating, driver_comment: comment ?? null })
      .eq("id", id)
      .eq("driver_id", me.id)
      .is("driver_rating", null)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error || !data) {
      return NextResponse.json({ error: "Already rated." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ride not found." }, { status: 404 });
}
