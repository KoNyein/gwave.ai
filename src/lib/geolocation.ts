/** A person (family circle member) to plot on the GPS map. */
export interface MapPerson {
  id: string;
  name: string;
  username?: string | null;
  latitude: number;
  longitude: number;
  avatarUrl?: string | null;
  /** ISO timestamp of their last location update. */
  updatedAt?: string | null;
}

/** Great-circle distance between two points, in metres (Haversine). */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Human distance: "820 m" or "3.4 km". */
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

/** Compass label (N, NE, …) for a heading in degrees, or null. */
export function compass(heading: number | null | undefined): string | null {
  if (heading == null || Number.isNaN(heading)) return null;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(heading / 45) % 8] ?? null;
}

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Metres above sea level, when the device reports it. */
  altitude?: number | null;
  /** Ground speed in metres/second, when moving. */
  speed?: number | null;
  /** Heading in degrees clockwise from true north (0–360), when moving. */
  heading?: number | null;
}

function fixFromPosition(position: GeolocationPosition): GeoFix {
  const c = position.coords;
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracy: c.accuracy ?? null,
    altitude: c.altitude ?? null,
    speed: c.speed ?? null,
    heading: c.heading ?? null,
  };
}

/**
 * Continuously watch the device's position (live GPS). Calls `onFix` on every
 * update and `onError` on failure. Returns a stop function; call it to clear
 * the watch.
 */
export function watchPosition(
  onFix: (fix: GeoFix) => void,
  onError?: (message: string) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError?.("Location is not available in this browser.");
    return () => undefined;
  }
  const id = navigator.geolocation.watchPosition(
    (position) => onFix(fixFromPosition(position)),
    (error) =>
      onError?.(
        error.code === error.PERMISSION_DENIED
          ? "Location permission was denied."
          : "Couldn't get your location.",
      ),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Browser geolocation as a promise, with friendly errors. */
export function getCurrentPosition(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(fixFromPosition(position)),
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : "Couldn't get your location.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
