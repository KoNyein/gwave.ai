import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ChessWager, LiveWager } from "@/types/database";

/** The current open/active wager in a conversation, if any (RLS-scoped). */
export async function getConversationWager(
  conversationId: string,
): Promise<ChessWager | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chess_wagers")
    .select("*")
    .eq("conversation_id", conversationId)
    .in("status", ["open", "active"])
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
