import "server-only";

import { createAdminClient } from "@/lib/data/admin";
import { sendFcmToUser } from "@/lib/fcm";
import { serverBroadcast } from "@/lib/realtime-server";

import type { RideRow, RideSettings } from "./types";

/**
 * Dispatch: deciding which driver is asked, and moving on when they don't
 * answer.
 *
 * ## Where the clock comes from
 *
 * A dispatcher needs something to advance it every few seconds. The options
 * were a long-running worker process (new infrastructure to deploy, supervise
 * and restart) or cron (one minute is its floor — sixty times too slow for a
 * rider watching a spinner).
 *
 * So the clock is the rider. Their app polls the ride while they wait, and
 * every poll calls `advanceDispatch()`. The rider is, by definition, present
 * and interested for exactly as long as dispatch needs to run, which makes them
 * a better scheduler than a timer that has to run whether or not anyone is
 * waiting. `/api/ride/dispatch/tick` exists as a sweeper for rides whose rider
 * closed the app mid-search; it can be called by an ordinary one-minute cron
 * because those rides are no longer time-critical — they just need to end.
 *
 * ## Why offers are stored rather than held in memory
 *
 * Every offer is a row. It costs a write, and it buys: an acceptance rate per
 * driver (the main lever on driver quality), an answer to "nobody came" that
 * names who was asked and what they did, and a dispatcher that survives a
 * server restart mid-search.
 */

/** Ask one driver at a time. Broadcasting to five at once means four drivers
 * accept a ride four of them will lose, and drivers stop trusting the app. */
const OFFERS_PER_ROUND = 1;

export interface NearbyDriver {
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  distance_m: number;
  updated_at: string;
}

export async function getSettings(): Promise<RideSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ride_settings")
    .select(
      "platform_gpay_account, search_radius_m, offer_timeout_s, max_offer_attempts, driver_stale_after_s, max_commission_owed, accepting_rides",
    )
    .eq("id", true)
    .maybeSingle<RideSettings>();
  return (
    data ?? {
      platform_gpay_account: null,
      search_radius_m: 5000,
      offer_timeout_s: 15,
      max_offer_attempts: 6,
      driver_stale_after_s: 60,
      max_commission_owed: 50000,
      accepting_rides: true,
    }
  );
}

/**
 * Advance one ride's search by at most one step, and report whether anything
 * changed.
 *
 * Safe to call concurrently and safe to call in a tight loop: it only acts on a
 * ride still in `requested`, and the work it does is either expiring an offer
 * that has genuinely run out of time or creating the next one. Two racing calls
 * can at worst both try to insert the same next offer, and the unique
 * (ride_id, driver_id) index makes the loser a no-op.
 */
export async function advanceDispatch(ride: RideRow): Promise<boolean> {
  if (ride.status !== "requested") return false;

  const admin = createAdminClient();
  const settings = await getSettings();

  // 1. Is an offer still live? Then dispatch is waiting, not stuck.
  const { data: open } = await admin
    .from("ride_offers")
    .select("id, driver_id, expires_at, attempt")
    .eq("ride_id", ride.id)
    .eq("response", "pending")
    .order("attempt", { ascending: false })
    .limit(1)
    .returns<{ id: string; driver_id: string; expires_at: string; attempt: number }[]>();

  const live = open?.[0];
  if (live) {
    if (new Date(live.expires_at).getTime() > Date.now()) return false;
    // Ran out of time. Record it as a timeout — distinct from a decline,
    // because "did not look at the phone" and "chose not to take it" are
    // different driver behaviours and only one of them is a quality problem.
    await admin
      .from("ride_offers")
      .update({ response: "timeout", responded_at: new Date().toISOString() })
      .eq("id", live.id)
      .eq("response", "pending");
    await serverBroadcast(`ride-driver:${live.driver_id}`, "offer_expired", {
      rideId: ride.id,
    });
  }

  // 2. Have we asked enough people?
  const { count: attempts } = await admin
    .from("ride_offers")
    .select("id", { count: "exact", head: true })
    .eq("ride_id", ride.id);
  const asked = attempts ?? 0;
  if (asked >= settings.max_offer_attempts) {
    await expireRide(ride);
    return true;
  }

  // 3. Who is nearby and hasn't been asked yet?
  const { data: nearbyData, error } = await admin.rpc("ride_nearest_drivers", {
    p_lat: ride.pickup_lat,
    p_lng: ride.pickup_lng,
    p_vehicle_type: ride.vehicle_type,
    p_radius_m: settings.search_radius_m,
    // Over-fetch so that excluding everyone already asked still leaves
    // somebody to ask.
    p_limit: settings.max_offer_attempts + 5,
    p_stale_after_s: settings.driver_stale_after_s,
  });
  if (error) {
    console.warn("[ride/dispatch] nearest drivers failed", error.message);
    return false;
  }
  const nearby = (nearbyData as NearbyDriver[] | null) ?? [];

  const { data: askedRows } = await admin
    .from("ride_offers")
    .select("driver_id")
    .eq("ride_id", ride.id)
    .returns<{ driver_id: string }[]>();
  const already = new Set((askedRows ?? []).map((r) => r.driver_id));

  const candidates = nearby.filter((d) => !already.has(d.driver_id));
  const eligible = await filterByDebt(candidates, ride, settings);

  if (eligible.length === 0) {
    // Nobody left to ask. If we never asked anyone, the ride expires now
    // rather than making the rider watch a search that cannot succeed.
    if (asked === 0 || live) {
      await expireRide(ride);
      return true;
    }
    return false;
  }

  for (const driver of eligible.slice(0, OFFERS_PER_ROUND)) {
    await offerTo(ride, driver, asked + 1, settings);
  }
  return true;
}

/**
 * Drop drivers who owe more commission than the platform allows.
 *
 * Only for cash rides: the debt exists because cash never passed through the
 * platform, and a wallet ride settles at source, so blocking a wallet ride over
 * a cash debt would punish the driver for the rider's payment choice.
 */
async function filterByDebt(
  drivers: NearbyDriver[],
  ride: RideRow,
  settings: RideSettings,
): Promise<NearbyDriver[]> {
  if (ride.payment_method !== "cash" || drivers.length === 0) return drivers;
  const admin = createAdminClient();
  const { data } = await admin
    .from("ride_driver_balances")
    .select("driver_id, commission_owed")
    .in(
      "driver_id",
      drivers.map((d) => d.driver_id),
    )
    .gte("commission_owed", settings.max_commission_owed)
    .returns<{ driver_id: string; commission_owed: number }[]>();
  const blocked = new Set((data ?? []).map((r) => r.driver_id));
  return drivers.filter((d) => !blocked.has(d.driver_id));
}

/** Create the offer row and ring the driver on both channels. */
async function offerTo(
  ride: RideRow,
  driver: NearbyDriver,
  attempt: number,
  settings: RideSettings,
): Promise<void> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + settings.offer_timeout_s * 1000);

  const { error } = await admin.from("ride_offers").insert({
    ride_id: ride.id,
    driver_id: driver.driver_id,
    distance_m: Math.round(driver.distance_m),
    attempt,
    expires_at: expiresAt.toISOString(),
  });
  // Unique (ride_id, driver_id) — a concurrent caller already made this offer,
  // which is the correct outcome, not a failure.
  if (error) return;

  const payload = {
    rideId: ride.id,
    vehicleType: ride.vehicle_type,
    pickup: { lat: ride.pickup_lat, lng: ride.pickup_lng, address: ride.pickup_address },
    dropoff: { lat: ride.dropoff_lat, lng: ride.dropoff_lng, address: ride.dropoff_address },
    fare: ride.quoted_fare,
    distanceM: ride.quoted_distance_m,
    durationS: ride.quoted_duration_s,
    paymentMethod: ride.payment_method,
    distanceToPickupM: Math.round(driver.distance_m),
    expiresAt: expiresAt.toISOString(),
  };

  // Realtime reaches a driver with the app open; FCM reaches one whose screen
  // is off. Both, because a ride offer that arrives 30 seconds late is worse
  // than useless — the driver taps Accept on a ride someone else is already
  // driving.
  await serverBroadcast(`ride-driver:${driver.driver_id}`, "ride_offer", payload);
  await sendFcmToUser(driver.driver_id, {
    notification: {
      title: "New ride request",
      body: `${ride.pickup_address} → ${ride.dropoff_address}`,
    },
    data: { type: "ride_offer", rideId: ride.id },
    // Expire the push with the offer. A ride offer that surfaces after the
    // window has closed makes the driver tap Accept on a ride that is already
    // someone else's — the single most annoying thing a dispatcher can do.
    ttl: `${settings.offer_timeout_s}s`,
  }).catch(() => undefined);
}

/** No driver took it. Tell the rider so their app can stop spinning. */
async function expireRide(ride: RideRow): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("rides")
    .update({ status: "expired" })
    .eq("id", ride.id)
    .eq("status", "requested");
  if (error) return;
  await admin
    .from("ride_offers")
    .update({ response: "cancelled", responded_at: new Date().toISOString() })
    .eq("ride_id", ride.id)
    .eq("response", "pending");
  await serverBroadcast(`ride:${ride.id}`, "ride_expired", { rideId: ride.id });
  await sendFcmToUser(ride.rider_id, {
    notification: {
      title: "No drivers available",
      body: "We couldn't find a driver nearby. Please try again.",
    },
    data: { type: "ride_expired", rideId: ride.id },
  }).catch(() => undefined);
}

/** Put a driver back on the market once their ride reaches a terminal state. */
export async function releaseDriver(driverId: string | null): Promise<void> {
  if (!driverId) return;
  const admin = createAdminClient();
  await admin
    .from("ride_driver_locations")
    .update({ is_available: true })
    .eq("driver_id", driverId)
    .eq("is_online", true);
}

/**
 * Tell both sides a ride changed. One helper so no route forgets a channel —
 * a state change the other party never sees is the bug that makes riders
 * phone their driver instead of using the app.
 */
export async function announceRide(
  ride: Pick<RideRow, "id" | "rider_id" | "driver_id" | "status">,
  event: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const payload = { rideId: ride.id, status: ride.status, ...extra };
  await serverBroadcast(`ride:${ride.id}`, event, payload);
  if (ride.driver_id) {
    await serverBroadcast(`ride-driver:${ride.driver_id}`, event, payload);
  }
}
