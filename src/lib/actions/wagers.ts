"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";
import { getConversationWager } from "@/lib/db/wagers";
import type { ChessWager, ChessWagerResult } from "@/types/database";

/** Load the current open/active wager in a conversation (client-callable). */
export async function loadConversationWager(
  conversationId: string,
): Promise<ChessWager | null> {
  if (!conversationId) return null;
  return getConversationWager(conversationId);
}

const createSchema = z.object({
  conversationId: z.string().uuid(),
  stakeMmk: z.number().min(100).max(10_000_000),
  isLive: z.boolean().optional(),
});

/** Open a chess wager — escrows the caller's stake from G-Pay. */
export async function createChessWager(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<string>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ဒေါ်လာပမာဏ မမှန်ပါ။" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_chess_wager", {
    p_conversation_id: d.conversationId,
    p_stake_mmk: d.stakeMmk,
    p_is_live: d.isLive ?? false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: String(data) };
}

/** Match an open wager's stake and start the match. */
export async function acceptChessWager(
  wagerId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_chess_wager", {
    p_wager: wagerId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}

/** Report the outcome; when both players agree the pot auto-settles. */
export async function reportChessResult(
  wagerId: string,
  result: ChessWagerResult,
): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_chess_result", {
    p_wager: wagerId,
    p_result: result,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: String(data ?? "pending") };
}

/** Cancel an open (unmatched) wager — refunds the stake. */
export async function cancelChessWager(
  wagerId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_chess_wager", {
    p_wager: wagerId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gpay");
  return { ok: true, data: undefined };
}

/** Toggle whether the match is broadcast live to spectators. */
export async function setWagerLive(
  wagerId: string,
  live: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_chess_wager_live", {
    p_wager: wagerId,
    p_live: live,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/arena");
  return { ok: true, data: undefined };
}

/** Count a unique spectator view (credits the host if monetized). */
export async function recordWagerView(wagerId: string): Promise<void> {
  if (!wagerId) return;
  const supabase = await createClient();
  await supabase.rpc("record_wager_view", { p_wager: wagerId });
}

/** Opt in / out of monetization (earning from live spectators + reels). */
export async function setMonetization(
  enabled: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_monetization", {
    p_enabled: enabled,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

/** Admin: resolve a disputed wager. */
export async function adminSettleWager(
  wagerId: string,
  result: ChessWagerResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_settle_chess_wager", {
    p_wager: wagerId,
    p_result: result,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/gpay");
  return { ok: true, data: undefined };
}
