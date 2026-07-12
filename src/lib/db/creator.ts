import "server-only";

import { createAnonClient } from "@/lib/supabase/anon";

export interface CreatorRow {
  author_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  games_count: number;
  total_plays: number;
  points: number;
}

/** Top community game creators, ranked by points (approved games + plays). */
export async function getCreatorLeaderboard(
  limit = 50,
): Promise<CreatorRow[]> {
  const supabase = createAnonClient();
  const { data } = await supabase.rpc("creator_leaderboard", { p_limit: limit });
  return (data as CreatorRow[] | null) ?? [];
}
