import "server-only";

/**
 * Road routing: distance, duration and the line to draw on the map.
 *
 * Deliberately behind an interface with two implementations, because this is
 * the one part of ride hailing with a real per-request price attached and the
 * right answer changes as the product grows:
 *
 *   OSRM (default)  — self-hosted, free. A Myanmar OSM extract is ~150MB and
 *                     runs as one container on the EC2 box we already pay for.
 *                     Set RIDE_OSRM_URL to point at it.
 *   Google          — better address coverage and live traffic, US$5 per 1,000
 *                     Directions calls. 10,000 rides/month = US$50/month, on a
 *                     product whose entire current AWS bill is US$228/month.
 *
 * Switching is one env var, so starting on OSRM costs nothing later.
 *
 * Every path degrades to a straight-line estimate rather than failing the ride.
 * A rider standing on a street corner would rather have an approximate fare
 * than an error, and the fare is re-derived from the actual GPS track at the
 * end anyway.
 */

export interface Route {
  distanceM: number;
  durationS: number;
  /** Encoded polyline (precision 5), or null when we fell back to a straight line. */
  polyline: string | null;
  /** Which provider actually answered — surfaced in logs and the admin view. */
  source: "osrm" | "google" | "estimate";
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Straight-line distance in metres. Also the fallback route, scaled up by a
 * detour factor because roads are not straight: 1.35 is the usual figure for
 * dense street grids, and Yangon's one-ways make it, if anything, generous.
 */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const DETOUR_FACTOR = 1.35;
/** Average city speed in m/s (~18 km/h) — Yangon traffic, not a highway. */
const CITY_SPEED_MS = 5;

function estimate(from: LatLng, to: LatLng): Route {
  const straight = haversineM(from, to);
  const distanceM = Math.round(straight * DETOUR_FACTOR);
  return {
    distanceM,
    durationS: Math.round(distanceM / CITY_SPEED_MS),
    polyline: null,
    source: "estimate",
  };
}

/** Abort rather than make a rider watch a spinner while a provider hangs. */
const TIMEOUT_MS = 6_000;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[ride/routing] ${new URL(url).host} -> ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.warn("[ride/routing] request failed", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function osrmRoute(
  base: string,
  from: LatLng,
  to: LatLng,
): Promise<Route | null> {
  // OSRM takes lng,lat — the opposite order to almost everything else, and
  // getting it backwards silently returns a plausible route somewhere else.
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${base.replace(/\/$/, "")}/route/v1/driving/${coords}?overview=full&geometries=polyline`;
  const body = (await fetchJson(url)) as
    | { code?: string; routes?: { distance?: number; duration?: number; geometry?: string }[] }
    | null;
  const route = body?.code === "Ok" ? body.routes?.[0] : undefined;
  if (!route || typeof route.distance !== "number" || typeof route.duration !== "number") {
    return null;
  }
  return {
    distanceM: Math.round(route.distance),
    durationS: Math.round(route.duration),
    polyline: route.geometry ?? null,
    source: "osrm",
  };
}

async function googleRoute(
  key: string,
  from: LatLng,
  to: LatLng,
): Promise<Route | null> {
  const url =
    "https://maps.googleapis.com/maps/api/directions/json" +
    `?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}` +
    `&mode=driving&departure_time=now&key=${encodeURIComponent(key)}`;
  const body = (await fetchJson(url)) as
    | {
        status?: string;
        routes?: {
          overview_polyline?: { points?: string };
          legs?: {
            distance?: { value?: number };
            duration?: { value?: number };
            duration_in_traffic?: { value?: number };
          }[];
        }[];
      }
    | null;
  const leg = body?.status === "OK" ? body.routes?.[0]?.legs?.[0] : undefined;
  if (!leg?.distance?.value || !leg?.duration?.value) return null;
  return {
    distanceM: Math.round(leg.distance.value),
    // Traffic-aware duration when Google gives one — that is most of what the
    // extra money buys, so use it when it is there.
    durationS: Math.round(leg.duration_in_traffic?.value ?? leg.duration.value),
    polyline: body?.routes?.[0]?.overview_polyline?.points ?? null,
    source: "google",
  };
}

/**
 * Route from A to B, trying the configured provider and falling back to a
 * straight-line estimate. Never throws and never returns null.
 */
export async function routeBetween(from: LatLng, to: LatLng): Promise<Route> {
  const osrm = process.env.RIDE_OSRM_URL;
  if (osrm) {
    const route = await osrmRoute(osrm, from, to);
    if (route) return route;
  }
  const googleKey = process.env.RIDE_GOOGLE_MAPS_KEY;
  if (googleKey) {
    const route = await googleRoute(googleKey, from, to);
    if (route) return route;
  }
  return estimate(from, to);
}

/**
 * How long a driver needs to reach the pickup. Uses the same router, but a
 * failure here is cheap: an ETA is advisory, so fall straight to the estimate
 * rather than spending a paid Directions call on it.
 */
export async function etaSeconds(from: LatLng, to: LatLng): Promise<number> {
  const osrm = process.env.RIDE_OSRM_URL;
  if (osrm) {
    const route = await osrmRoute(osrm, from, to);
    if (route) return route.durationS;
  }
  return estimate(from, to).durationS;
}
