import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/drone/nearby?lat=&lng=&radius=&minutes=
 *
 * Returns the live networked drone detections (from SDR sensors + other clients)
 * near a point, so the app can plot signals a phone's own radios can't hear.
 * Read-only environmental data (no user PII); filtered to non-expired rows and,
 * when lat/lng are given, to a radius in metres (default 8 km). Detections
 * without coordinates are always included (a bearing-only sensor hit).
 */
interface Row {
  id: string;
  source: string | null;
  protocol: string | null;
  vendor: string | null;
  label: string | null;
  rssi: number | null;
  lat: number | null;
  lng: number | null;
  altitude_m: number | null;
  remote_id: string | null;
  detected_at: string;
}

function haversineM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const lat = p.has("lat") ? Number(p.get("lat")) : null;
  const lng = p.has("lng") ? Number(p.get("lng")) : null;
  const radius = Math.min(50000, Math.max(200, Number(p.get("radius")) || 8000));
  const minutes = Math.min(60, Math.max(1, Number(p.get("minutes")) || 10));
  const since = new Date(Date.now() - minutes * 60_000).toISOString();

  const sb = createAdminClient() as unknown as {
    from(table: string): {
      select(cols: string): {
        gt(
          col: string,
          val: string,
        ): {
          gte(
            col: string,
            val: string,
          ): {
            order(
              col: string,
              opts: { ascending: boolean },
            ): {
              limit(n: number): PromiseLike<{ data: Row[] | null }>;
            };
          };
        };
      };
    };
  };

  const nowIso = new Date().toISOString();
  const { data } = await sb
    .from("drone_detections")
    .select(
      "id,source,protocol,vendor,label,rssi,lat,lng,altitude_m,remote_id,detected_at",
    )
    .gt("expires_at", nowIso)
    .gte("detected_at", since)
    .order("detected_at", { ascending: false })
    .limit(300);

  let rows = data ?? [];
  if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    rows = rows.filter(
      (r) =>
        r.lat === null ||
        r.lng === null ||
        haversineM(lat, lng, r.lat, r.lng) <= radius,
    );
  }

  return NextResponse.json({
    detections: rows.map((r) => ({
      id: r.id,
      source: r.source,
      protocol: r.protocol,
      vendor: r.vendor,
      label: r.label,
      rssi: r.rssi,
      lat: r.lat,
      lng: r.lng,
      altitudeM: r.altitude_m,
      remoteId: r.remote_id,
      detectedAt: r.detected_at,
    })),
  });
}
