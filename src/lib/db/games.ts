import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

/** A game row with its author embedded (list/detail cards). */
export interface GameWithAuthor extends Game {
  author: AuthorSummary;
}

const GAME_SELECT =
  "*, author:profiles!games_author_id_fkey(id, username, full_name, avatar_url)";

/** Approved community games, most-played first. */
export async function getApprovedGames(limit = 60): Promise<GameWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("status", "approved")
    .order("plays_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<GameWithAuthor[]>();

  if (error) throw new Error(`Failed to load games: ${error.message}`);
  return data ?? [];
}

/** All of the viewer's own submissions (any status), newest first. */
export async function getMyGames(userId: string): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .returns<Game[]>();

  if (error) throw new Error(`Failed to load your games: ${error.message}`);
  return data ?? [];
}

/**
 * One game with author. RLS decides visibility: approved games for everyone,
 * pending/rejected only for their author and moderators.
 */
export async function getGame(id: string): Promise<GameWithAuthor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("id", id)
    .maybeSingle<GameWithAuthor>();

  if (error) throw new Error(`Failed to load game: ${error.message}`);
  return data;
}

/**
 * Review queue for moderators: every pending game (oldest first, so nothing
 * ever ages out of the queue), followed by the most recent decisions.
 */
export async function getGamesForReview(): Promise<GameWithAuthor[]> {
  const supabase = await createClient();
  const [pendingRes, decidedRes] = await Promise.all([
    supabase
      .from("games")
      .select(GAME_SELECT)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .returns<GameWithAuthor[]>(),
    supabase
      .from("games")
      .select(GAME_SELECT)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<GameWithAuthor[]>(),
  ]);

  if (pendingRes.error) {
    throw new Error(`Failed to load review queue: ${pendingRes.error.message}`);
  }
  if (decidedRes.error) {
    throw new Error(`Failed to load review queue: ${decidedRes.error.message}`);
  }
  return [...(pendingRes.data ?? []), ...(decidedRes.data ?? [])];
}
