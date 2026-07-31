import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { rideCaller } from "@/lib/ride/auth";
import { searchPlaces, withDistance, type Place } from "@/lib/ride/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where do you want to go?
 *
 * The rider's own past destinations come first and always. Most trips a person
 * takes are somewhere they have already been, no geocoder answers a label
 * somebody wrote for themselves, and every geocoder mangles Myanmar addresses —
 * so their own history is both the cheapest source and the best one. With no
 * query at all this returns recent destinations, which is the list a rider
 * wants the moment they open the screen.
 *
 * External results are appended, deduplicated against history, and only when a
 * provider is configured. With none, history-only search still works: a rider
 * can always get back to somewhere they have been, and the map stays tappable
 * for everywhere else.
 */

/** Past rides scanned for suggestions. Enough for months of a daily commuter. */
const HISTORY_ROWS = 200;
const HISTORY_SUGGESTIONS = 6;

interface HistoryRow {
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  completed_at: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const near =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  const history = await historyPlaces(me.id, q, near);

  // Only pay a provider once the query is worth answering. One or two
  // characters match everything and are almost always still being typed.
  const external = q.length >= 3 ? await searchPlaces(q, near) : [];

  // Deduplicate by label — a rider does not need "Junction City" twice because
  // the geocoder also knows about it. History wins: their own wording is the
  // one they will recognise.
  const seen = new Set(history.map((p) => p.label.toLowerCase()));
  const merged = [
    ...history,
    ...external.filter((p) => !seen.has(p.label.toLowerCase())),
  ];

  return NextResponse.json({ places: merged.slice(0, 12) });
}

async function historyPlaces(
  userId: string,
  q: string,
  near: { lat: number; lng: number } | null,
): Promise<Place[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("rides")
    .select("dropoff_address, dropoff_lat, dropoff_lng, completed_at, created_at")
    .eq("rider_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_ROWS)
    .returns<HistoryRow[]>();

  const needle = q.toLowerCase();
  const byLabel = new Map<string, Place>();
  for (const row of data ?? []) {
    const label = (row.dropoff_address ?? "").trim();
    // "Dropped pin" is what the app stores when a rider never named the place.
    // Offering it back as a suggestion is offering them nothing.
    if (!label || label.toLowerCase() === "dropped pin") continue;
    if (needle && !label.toLowerCase().includes(needle)) continue;
    // First occurrence wins, and the rows arrive newest-first, so this keeps
    // the most recent coordinates for a place the rider goes to often.
    if (byLabel.has(label.toLowerCase())) continue;
    byLabel.set(label.toLowerCase(), {
      label,
      detail: "Recent",
      lat: row.dropoff_lat,
      lng: row.dropoff_lng,
      source: "history",
    });
    if (byLabel.size >= HISTORY_SUGGESTIONS) break;
  }

  return withDistance([...byLabel.values()], near);
}
