import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ChessWager, LiveWager } from "@/types/database";

/** The current open/active wager in a conversation, if any (RLS-scoped). */
export async function getConversationWager(
  conversationId: string,
  game?: "chess" | "kyar",
): Promise<ChessWager | null> {
  const supabase = await createClient();
  let query = supabase
    .from("chess_wagers")
    .select("*")
    .eq("conversation_id", conversationId)
    .in("status", ["open", "active"]);
  if (game) query = query.eq("game", game);
  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ChessWager>();
  return data ?? null;
}

/** A single wager by id (RLS lets players, admins, and — if live — anyone read). */
export async function getWager(id: string): Promise<ChessWager | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chess_wagers")
    .select("*")
    .eq("id", id)
    .maybeSingle<ChessWager>();
  return data ?? null;
}

/** Public "watch live" directory of active, broadcast matches. */
export async function getLiveWagers(limit = 30): Promise<LiveWager[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_live_wagers", { p_limit: limit });
  return (data as LiveWager[] | null) ?? [];
}

/** Disputed wagers awaiting admin resolution (admin-only via RLS). */
export async function getDisputedWagers(): Promise<ChessWager[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chess_wagers")
    .select("*")
    .eq("status", "disputed")
    .order("updated_at", { ascending: false })
    .returns<ChessWager[]>();
  return data ?? [];
}

export interface DisputedWager extends ChessWager {
  host_name: string | null;
  guest_name: string | null;
}

/** Disputed wagers with both players' display names resolved. */
export async function getDisputedWagersWithPlayers(): Promise<
  DisputedWager[]
> {
  const wagers = await getDisputedWagers();
  if (wagers.length === 0) return [];

  const ids = [
    ...new Set(
      wagers.flatMap((w) => [w.host_id, w.guest_id]).filter(Boolean),
    ),
  ] as string[];
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", ids);
  const names = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p.display_name as string | null) ?? (p.username as string | null),
    ]),
  );
  return wagers.map((w) => ({
    ...w,
    host_name: names.get(w.host_id) ?? null,
    guest_name: w.guest_id ? (names.get(w.guest_id) ?? null) : null,
  }));
}
