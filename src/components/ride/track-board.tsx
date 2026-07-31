"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const TrackMap = dynamic(() => import("./track-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted" />,
});

interface Trip {
  status: string;
  vehicleType: string;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  startedAt: string | null;
  endedAt: string | null;
  driver: {
    name: string | null;
    plate: string | null;
    vehicle: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

const HEADLINE: Record<string, string> = {
  requested: "Looking for a driver",
  accepted: "Driver on the way to the pickup",
  arrived: "Driver has arrived at the pickup",
  in_progress: "On the way to the destination",
  completed: "Arrived safely",
  cancelled: "Trip cancelled",
  expired: "No driver was found",
};

/**
 * Follow a shared trip. Public — whoever holds the link, no account.
 *
 * Polls every 5 seconds. A websocket would be smoother, but this page is
 * usually open on someone else's phone for twenty minutes and a poll needs no
 * auth, no reconnect logic and no socket budget. When the trip ends the polling
 * stops, because a page that keeps hitting the server after "Arrived safely" is
 * pure waste.
 */
export function TrackBoard({ token, initial }: { token: string; initial: Trip }) {
  const [trip, setTrip] = React.useState<Trip>(initial);
  const [gone, setGone] = React.useState(false);
  const live = !trip.endedAt;

  React.useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/ride/track/${token}`, { cache: "no-store" });
        if (res.status === 410 || res.status === 404) {
          if (!cancelled) setGone(true);
          return;
        }
        if (!res.ok) return;
        const next = (await res.json()) as Trip;
        if (!cancelled) setTrip(next);
      } catch {
        // A dropped poll is not worth showing; the next one is 5s away.
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, live]);

  const car =
    trip.driver?.lat != null && trip.driver?.lng != null
      ? { lat: trip.driver.lat, lng: trip.driver.lng }
      : null;

  return (
    <div className="flex h-dvh flex-col">
      <div className="min-h-0 flex-1">
        <TrackMap pickup={trip.pickup} dropoff={trip.dropoff} car={car} />
      </div>

      <div className="border-t bg-background px-4 pb-6 pt-4">
        <div className="mx-auto w-full max-w-md space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground"
              }`}
            />
            <h1 className="text-lg font-bold">
              {HEADLINE[trip.status] ?? "Trip update"}
            </h1>
          </div>

          {gone && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              This link has expired.
            </p>
          )}

          {trip.driver && (
            <div className="rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">
                  {trip.driver.name ?? "Driver"}
                </span>
                {trip.driver.plate && (
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-bold tracking-wider">
                    {trip.driver.plate}
                  </span>
                )}
              </div>
              {trip.driver.vehicle && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {trip.driver.vehicle}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 text-sm">
            <Leg colour="bg-emerald-500" text={trip.pickup.address} />
            <Leg colour="bg-red-500" text={trip.dropoff.address} />
          </div>

          <p className="text-xs text-muted-foreground">
            Shared from Gwave. This page shows the vehicle and its position only
            — no phone numbers and no payment details.
          </p>
        </div>
      </div>
    </div>
  );
}

function Leg({ colour, text }: { colour: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colour}`} />
      <span className="truncate">{text}</span>
    </div>
  );
}
