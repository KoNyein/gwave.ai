import "server-only";

import { haversineM, type LatLng } from "./routing";

/**
 * Turning what someone types into a place on the map.
 *
 * Same shape as routing.ts — an interface with a self-hosted default and a paid
 * upgrade — but with one addition that matters more than either provider:
 *
 * **The rider's own history is searched first, and it is free.** Most trips a
 * person takes are to somewhere they have already been: home, work, their
 * mother's house. No geocoder answers "မိခင်အိမ်" and every geocoder mangles
 * Myanmar addresses, but the rider's own past destination labels are exactly
 * right, because they wrote them. Handing that back is better autocomplete
 * than any paid API and costs one indexed query.
 *
 * External providers, in order:
 *   Photon / Nominatim (RIDE_GEOCODER_URL) — self-hosted, free.
 *   Google Places (RIDE_GOOGLE_MAPS_KEY)   — better Myanmar coverage, paid.
 *
 * With neither configured, history-only search still works. That is the honest
 * degradation: a rider can always reach somewhere they have been before, and
 * the map is still tappable for everywhere else.
 */

export interface Place {
  label: string;
  /** Region/township or the provider's secondary line; may be empty. */
  detail: string;
  lat: number;
  lng: number;
  /** Where this suggestion came from — the app badges history differently. */
  source: "history" | "geocoder" | "google";
  /** Metres from the rider, when a location was supplied. */
  distanceM?: number;
}

const TIMEOUT_MS = 5_000;

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Nominatim's usage policy requires identifying the caller, and a
      // self-hosted Photon does not mind.
      headers: { "User-Agent": "Gwave/1.0 (https://gwave.cc)" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Photon and Nominatim, told apart by their response shape rather than by
 * configuration — one env var is easier to get right than two, and the two
 * formats are unmistakable.
 */
async function geocoderSearch(
  base: string,
  q: string,
  near: LatLng | null,
): Promise<Place[]> {
  const root = base.replace(/\/$/, "");
  const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : "";
  const body = await fetchJson(
    `${root}/api?q=${encodeURIComponent(q)}&limit=8&lang=en${bias}`,
  );

  // Photon: GeoJSON FeatureCollection.
  const features = (body as { features?: unknown[] } | null)?.features;
  if (Array.isArray(features)) {
    return features
      .map((f): Place | null => {
        const feature = f as {
          properties?: Record<string, unknown>;
          geometry?: { coordinates?: number[] };
        };
        const coords = feature.geometry?.coordinates;
        const p = feature.properties ?? {};
        // GeoJSON is [lng, lat] — the opposite of everything else here, and
        // getting it backwards puts every result in the sea off Somalia.
        const lng = coords?.[0];
        const lat = coords?.[1];
        if (typeof lat !== "number" || typeof lng !== "number") return null;
        const label = String(p.name ?? p.street ?? p.city ?? "").trim();
        if (!label) return null;
        return {
          label,
          detail: [p.district, p.city, p.state]
            .filter((v) => typeof v === "string" && v)
            .join(", "),
          lat,
          lng,
          source: "geocoder" as const,
        };
      })
      .filter((p): p is Place => p !== null);
  }

  // Nominatim: a bare array.
  if (Array.isArray(body)) {
    return body
      .map((r): Place | null => {
        const row = r as { lat?: string; lon?: string; display_name?: string };
        const lat = Number(row.lat);
        const lng = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const parts = (row.display_name ?? "").split(",").map((s) => s.trim());
        const label = parts[0];
        if (!label) return null;
        return {
          label,
          detail: parts.slice(1, 3).join(", "),
          lat,
          lng,
          source: "geocoder" as const,
        };
      })
      .filter((p): p is Place => p !== null);
  }

  return [];
}

async function googleSearch(
  key: string,
  q: string,
  near: LatLng | null,
): Promise<Place[]> {
  const bias = near ? `&location=${near.lat},${near.lng}&radius=30000` : "";
  const body = (await fetchJson(
    "https://maps.googleapis.com/maps/api/place/textsearch/json" +
      `?query=${encodeURIComponent(q)}&region=mm${bias}` +
      `&key=${encodeURIComponent(key)}`,
  )) as {
    status?: string;
    results?: {
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }[];
  } | null;

  if (body?.status !== "OK") return [];
  return (body.results ?? [])
    .map((r): Place | null => {
      const lat = r.geometry?.location?.lat;
      const lng = r.geometry?.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number" || !r.name) {
        return null;
      }
      return {
        label: r.name,
        detail: r.formatted_address ?? "",
        lat,
        lng,
        source: "google" as const,
      };
    })
    .filter((p): p is Place => p !== null);
}

/**
 * External place search. Returns an empty list rather than throwing when no
 * provider is configured — the caller's history results are still worth
 * showing, and an error here would hide them.
 */
export async function searchPlaces(
  q: string,
  near: LatLng | null,
): Promise<Place[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const geocoder = process.env.RIDE_GEOCODER_URL;
  if (geocoder) {
    const found = await geocoderSearch(geocoder, query, near);
    if (found.length) return withDistance(found, near);
  }
  const googleKey = process.env.RIDE_GOOGLE_MAPS_KEY;
  if (googleKey) {
    return withDistance(await googleSearch(googleKey, query, near), near);
  }
  return [];
}

export function withDistance(places: Place[], near: LatLng | null): Place[] {
  if (!near) return places;
  return places.map((p) => ({
    ...p,
    distanceM: Math.round(haversineM(near, { lat: p.lat, lng: p.lng })),
  }));
}
