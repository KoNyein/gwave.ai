import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LiveGift } from "@/types/database";

export interface TopGifter {
  sender_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  total_mmk: number;
  gift_count: number;
}

/**
 * The active gift catalog, cheapest first.
 *
 * Must use the cookie-bound client: the only policy on `live_gifts` is granted
 * to `authenticated` (see 20260712100000_live_gifts.sql), so reading it as the
 * `anon` role returns zero rows and silently renders an empty gift picker.
 */
export async function getLiveGifts(): Promise<LiveGift[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_gifts")
    .select("*")
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .returns<LiveGift[]>();
  return data ?? [];
}

/** Total G-Pay gifted to a stream — the numerator of the support-goal bar. */
export async function getStreamGiftTotal(streamId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("live_gift_total", { p_stream: streamId });
  return Number(data ?? 0);
}

/** Top supporters of a stream, by total G-Pay gifted. */
export async function getTopGifters(streamId: string): Promise<TopGifter[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("live_top_gifters", {
    p_stream: streamId,
    p_limit: 10,
  });
  return (data as TopGifter[] | null) ?? [];
}
