import "server-only";

import { createClient } from "@/lib/data/server";

export type TrackerType = "bluetooth" | "wifi" | "nfc" | "airtag" | "other";

export interface Tracker {
  id: string;
  owner_id: string;
  name: string;
  type: TrackerType;
  identifier: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  battery: number | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

/** The caller's own trackers (RLS-scoped to auth.uid()). */
export async function getMyTrackers(ownerId: string): Promise<Tracker[]> {
  const db = await createClient();
  const { data } = await db
    .from("trackers")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .returns<Tracker[]>();
  return data ?? [];
}
