import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/wifi/observe — the app scanned nearby WiFi at a GPS point.
 * Each access point (by BSSID) is upserted into the shared crowdsourced map:
 * a new AP is inserted; a known one keeps the strongest-signal location and
 * bumps its observation count. Writes go through the admin client (the table
 * is public-read only).
 */
const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  networks: z
    .array(
      z.object({
        bssid: z.string().min(1).max(64),
        ssid: z.string().max(120).optional(),
        signal: z.number().int().min(-120).max(0).optional(),
        security: z.string().max(40).optional(),
      }),
    )
    .max(200),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scan payload." }, { status: 400 });
  }
  const { latitude, longitude, networks } = parsed.data;
  if (networks.length === 0) return NextResponse.json({ saved: 0 });

  const admin = createAdminClient();
  const bssids = networks.map((n) => n.bssid.toLowerCase());

  // Read the existing rows once, then decide insert vs. strengthen in code
  // (flat query — no embeds on this hot path).
  const { data: existing } = await admin
    .from("wifi_networks")
    .select("bssid, best_signal, observations")
    .in("bssid", bssids)
    .returns<
      { bssid: string; best_signal: number | null; observations: number }[]
    >();
  const known = new Map((existing ?? []).map((r) => [r.bssid, r]));

  const rows = networks.map((n) => {
    const bssid = n.bssid.toLowerCase();
    const prev = known.get(bssid);
    const signal = n.signal ?? -99;
    // Keep the strongest-signal fix as the AP's location; a stronger reading
    // means we're closer, so it's a better position estimate.
    const stronger = !prev || signal > (prev.best_signal ?? -999);
    return {
      bssid,
      ssid: n.ssid || null,
      security: n.security || null,
      best_signal: prev ? Math.max(prev.best_signal ?? -999, signal) : signal,
      ...(stronger ? { latitude, longitude } : {}),
      observations: (prev?.observations ?? 0) + 1,
      first_user: prev ? undefined : claims.sub,
      last_seen_at: new Date().toISOString(),
    };
  });

  // For new rows we must supply latitude/longitude; ensure every row has them.
  const upsertRows = rows.map((r) => ({
    ...r,
    latitude: (r as { latitude?: number }).latitude ?? latitude,
    longitude: (r as { longitude?: number }).longitude ?? longitude,
  }));

  const { error } = await admin
    .from("wifi_networks")
    .upsert(upsertRows, { onConflict: "bssid" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ saved: upsertRows.length });
}
