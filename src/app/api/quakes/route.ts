import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/quakes — recent earthquakes for the SOS map, from the USGS FDSN
 * event service (public, no key).
 *
 *   ?hours=72     look-back window (1..720, default 72)
 *   ?minmag=2.5   minimum magnitude (0..9, default 2.5)
 *
 * Scoped to a box around Myanmar and its seismic neighbourhood — the Sagaing
 * fault runs the length of the country and the Sumatra–Andaman arc to its
 * south is what makes a tsunami flag worth carrying. The box spans roughly
 * Bangladesh→Vietnam and south to the Sunda trench.
 *
 * Served from here rather than the phones calling USGS directly so that one
 * cached answer covers every user (USGS asks integrators to be gentle), the
 * web map avoids CORS, and the response shape stays ours: a flat array the
 * app can render without knowing GeoJSON exists.
 */
const BOX = { minLat: -12, maxLat: 33, minLng: 84, maxLng: 112 };
const CACHE_MS = 120_000;
const USGS = "https://earthquake.usgs.gov/fdsnws/event/1/query";

export interface Quake {
  id: string;
  mag: number;
  place: string;
  lat: number;
  lng: number;
  depthKm: number | null;
  /** Epoch milliseconds (UTC). */
  time: number;
  url: string | null;
  tsunami: boolean;
}

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    url: string | null;
    tsunami: number | null;
  };
  geometry: { coordinates: [number, number, number | null] } | null;
}

// One entry per (hours, minmag) pair; both are clamped so the key space is
// tiny and an attacker can't grow the cache.
const cache = new Map<string, { at: number; body: Quake[] }>();

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const hours = Math.min(
    Math.max(Math.round(Number(params.get("hours")) || 72), 1),
    720,
  );
  const minmag = Math.min(Math.max(Number(params.get("minmag")) || 2.5, 0), 9);

  const key = `${hours}:${minmag}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ quakes: hit.body, cached: true });
  }

  const start = new Date(Date.now() - hours * 3_600_000).toISOString();
  const url =
    `${USGS}?format=geojson&orderby=time&limit=300` +
    `&starttime=${encodeURIComponent(start)}` +
    `&minmagnitude=${minmag}` +
    `&minlatitude=${BOX.minLat}&maxlatitude=${BOX.maxLat}` +
    `&minlongitude=${BOX.minLng}&maxlongitude=${BOX.maxLng}`;

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "gwave.cc SOS map (contact: admin@gwave.cc)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) throw new Error(`USGS answered ${upstream.status}`);
    const data = (await upstream.json()) as { features?: UsgsFeature[] };

    const quakes: Quake[] = (data.features ?? [])
      .filter((f) => f.geometry?.coordinates && f.properties.mag != null)
      .map((f) => ({
        id: f.id,
        mag: f.properties.mag as number,
        place: f.properties.place ?? "",
        lng: f.geometry!.coordinates[0],
        lat: f.geometry!.coordinates[1],
        depthKm: f.geometry!.coordinates[2],
        time: f.properties.time,
        url: f.properties.url,
        tsunami: (f.properties.tsunami ?? 0) > 0,
      }));

    cache.set(key, { at: Date.now(), body: quakes });
    return NextResponse.json({ quakes });
  } catch (error) {
    // A stale answer beats none in the one situation this data matters most.
    if (hit) return NextResponse.json({ quakes: hit.body, cached: true });
    console.error(`[quakes] USGS fetch failed: ${(error as Error).message}`);
    return NextResponse.json(
      { error: "Earthquake feed is unreachable right now." },
      { status: 502 },
    );
  }
}
