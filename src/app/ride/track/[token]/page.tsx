import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TrackBoard } from "@/components/ride/track-board";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Follow a shared trip — public, no account, top-level route so the URL a rider
 * sends stays short enough to read out over the phone.
 *
 * Deliberately `noindex`: these links are personal and short-lived, and a
 * search engine holding one forever is the opposite of what sharing a trip is
 * for.
 */
export const metadata: Metadata = {
  title: "Trip tracking · Gwave",
  robots: { index: false, follow: false },
};

/** How long after a trip ends the page keeps working. Matches the API. */
const GRACE_MS = 30 * 60 * 1000;

export default async function TrackPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  if (!token || token.length < 20) notFound();

  // Rendered on the server for the first paint so the follower sees the trip
  // immediately rather than a spinner; the client then polls for movement.
  const admin = createAdminClient();
  const { data: ride } = await admin
    .from("rides")
    .select(
      "driver_id, status, vehicle_type, pickup_lat, pickup_lng, pickup_address, " +
        "dropoff_lat, dropoff_lng, dropoff_address, started_at, completed_at, cancelled_at",
    )
    .eq("share_token", token)
    .maybeSingle<{
      driver_id: string | null;
      status: string;
      vehicle_type: string;
      pickup_lat: number;
      pickup_lng: number;
      pickup_address: string;
      dropoff_lat: number;
      dropoff_lng: number;
      dropoff_address: string;
      started_at: string | null;
      completed_at: string | null;
      cancelled_at: string | null;
    }>();

  if (!ride) notFound();

  const ended = ride.completed_at ?? ride.cancelled_at;
  if (ended && Date.now() - new Date(ended).getTime() > GRACE_MS) notFound();

  let driver: {
    name: string | null;
    plate: string | null;
    vehicle: string | null;
    lat: number | null;
    lng: number | null;
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
        .select("latitude, longitude")
        .eq("driver_id", ride.driver_id)
        .maybeSingle<{ latitude: number; longitude: number }>(),
    ]);
    const full = profile?.full_name ?? profile?.username ?? null;
    driver = {
      name: full ? full.split(" ")[0] ?? full : null,
      plate: card?.plate_number ?? null,
      vehicle:
        [card?.vehicle_color, card?.vehicle_make, card?.vehicle_model]
          .filter(Boolean)
          .join(" ") || null,
      lat: ended ? null : pos?.latitude ?? null,
      lng: ended ? null : pos?.longitude ?? null,
    };
  }

  return (
    <TrackBoard
      token={token}
      initial={{
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
      }}
    />
  );
}
