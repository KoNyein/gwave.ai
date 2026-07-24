import { NextRequest, NextResponse } from "next/server";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/wifi/nearby?lat=&lng=&radius=km — the collected WiFi points
 * around a map viewport, for the crowdsourced WiFi map. Simple bounding-box
 * filter (fast with the lat/lng index); ~0.05° ≈ 5 km by default.
 */
function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

export async function GET(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required." }, { status: 400 });
  }
  const km = Math.min(Math.max(Number(url.searchParams.get("radius")) || 5, 1), 20);
  const dLat = km / 111; // ~111 km per degree latitude
  const dLng = km / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wifi_networks")
    .select("bssid, ssid, security, best_signal, latitude, longitude, observations")
    .gte("latitude", lat - dLat)
    .lte("latitude", lat + dLat)
    .gte("longitude", lng - dLng)
    .lte("longitude", lng + dLng)
    .order("best_signal", { ascending: false })
    .limit(1000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ networks: data ?? [] });
}
