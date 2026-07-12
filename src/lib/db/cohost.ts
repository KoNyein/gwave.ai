import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CohostRoom } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface CohostRoomWithHost extends CohostRoom {
  host: AuthorSummary | null;
}

/** Currently-live co-host rooms (open, started within the last 6 hours). */
export async function getActiveCohostRooms(): Promise<CohostRoomWithHost[]> {
  const supabase = await createClient();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("cohost_rooms")
    .select(
      "*, host:profiles!cohost_rooms_host_id_fkey(id, username, full_name, avatar_url)",
    )
    .is("ended_at", null)
    .gte("created_at", sixHoursAgo)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<CohostRoomWithHost[]>();
  return data ?? [];
}

/** A single room by its code. */
export async function getCohostRoom(
  code: string,
): Promise<CohostRoomWithHost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cohost_rooms")
    .select(
      "*, host:profiles!cohost_rooms_host_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("code", code)
    .maybeSingle<CohostRoomWithHost>();
  return data ?? null;
}
