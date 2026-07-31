import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { advanceDispatch, getSettings } from "@/lib/ride/dispatch";
import { RIDE_COLUMNS, type RideRow } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The sweeper.
 *
 * Dispatch is normally driven by the waiting rider's own polling (see
 * lib/ride/dispatch.ts). This exists for the rides nobody is watching: the
 * rider whose app was killed, whose phone died, who walked into the underground
 * mid-search. Those rides are no longer time-critical — they just need to stop
 * being "requested" — so a one-minute cron is fast enough and no long-running
 * worker process has to be deployed and supervised.
 *
 * It also marks vanished drivers offline. A driver whose app was force-stopped
 * never sends "going offline", so without this they stay in the dispatch pool
 * forever and every ride near them burns an offer attempt on a phone that will
 * never ring.
 *
 * Protected by RIDE_DISPATCH_SECRET. Without the secret set the route refuses
 * to run rather than defaulting to open — an unauthenticated endpoint that
 * mutates ride state would let anyone time out every offer in the system.
 *
 *   * * * * * curl -sS -X POST https://gwave.cc/api/ride/dispatch/tick \
 *       -H "x-dispatch-secret: $RIDE_DISPATCH_SECRET" >/dev/null
 */

/** Don't let one invocation run forever if the queue is long. */
const MAX_RIDES_PER_TICK = 25;

export async function POST(request: NextRequest) {
  const secret = process.env.RIDE_DISPATCH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Dispatch sweeper is not configured." },
      { status: 503 },
    );
  }
  if (request.headers.get("x-dispatch-secret") !== secret) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const admin = createAdminClient();
  const settings = await getSettings();

  const { data: rides } = await admin
    .from("rides")
    .select(RIDE_COLUMNS)
    .eq("status", "requested")
    .order("requested_at", { ascending: true })
    .limit(MAX_RIDES_PER_TICK)
    .returns<RideRow[]>();

  let advanced = 0;
  for (const ride of rides ?? []) {
    if (await advanceDispatch(ride)) advanced += 1;
  }

  // Drivers whose heartbeat stopped. Given a generous multiple of the stale
  // window so a driver in a tunnel isn't kicked out of the pool for a lost
  // fix — they come straight back on their next heartbeat anyway.
  const cutoff = new Date(
    Date.now() - settings.driver_stale_after_s * 3 * 1000,
  ).toISOString();
  const { data: gone } = await admin
    .from("ride_driver_locations")
    .update({ is_online: false, is_available: false })
    .eq("is_online", true)
    .lt("updated_at", cutoff)
    .select("driver_id")
    .returns<{ driver_id: string }[]>();

  return NextResponse.json({
    scanned: rides?.length ?? 0,
    advanced,
    driversMarkedOffline: gone?.length ?? 0,
  });
}
