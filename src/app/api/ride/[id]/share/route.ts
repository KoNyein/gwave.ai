import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { rideCaller } from "@/lib/ride/auth";
import { RIDE_ACTIVE_STATUSES, type RideRow } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Share my trip" — mint a link that lets someone follow this ride without a
 * Gwave account.
 *
 * Only the rider can mint it. A driver who could publish a link to their
 * passenger's live position and destination would have a stalking tool, not a
 * safety feature.
 *
 * The token is 32 random bytes, base64url. Guessing one is not a threat model
 * anybody needs to worry about, and it means the follower needs no login — the
 * person a rider sends this to at 11pm is often not a Gwave user.
 *
 * Minting is idempotent: re-sharing the same ride returns the same link, so a
 * rider who shares with two people does not invalidate the first one's link.
 */
export async function POST(
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
    .select("id, rider_id, status, share_token")
    .eq("id", id)
    .maybeSingle<Pick<RideRow, "id" | "rider_id" | "status"> & { share_token: string | null }>();
  if (!ride || ride.rider_id !== me.id) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }
  if (!RIDE_ACTIVE_STATUSES.includes(ride.status)) {
    return NextResponse.json(
      { error: "That trip has already ended." },
      { status: 409 },
    );
  }

  let token = ride.share_token;
  if (!token) {
    token = randomBytes(32).toString("base64url");
    const { error } = await admin
      .from("rides")
      .update({ share_token: token, shared_at: new Date().toISOString() })
      .eq("id", id)
      .is("share_token", null);
    if (error) {
      // Lost a race with the rider's own second tap — read back whoever won,
      // so both taps hand out the same link.
      const { data: fresh } = await admin
        .from("rides")
        .select("share_token")
        .eq("id", id)
        .maybeSingle<{ share_token: string | null }>();
      token = fresh?.share_token ?? null;
    }
  }

  if (!token) {
    return NextResponse.json({ error: "Could not create the link." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/ride/track/${token}`, token });
}
