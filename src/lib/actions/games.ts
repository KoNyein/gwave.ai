"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

// Matches the DB check constraint — a single self-contained HTML document.
const MAX_CODE_CHARS = 200_000;

const submitGameSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500),
  emoji: z.string().trim().min(1).max(8),
  code: z.string().min(1).max(MAX_CODE_CHARS),
});

export type SubmitGameInput = z.infer<typeof submitGameSchema>;

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Submit (or resubmit) a community game. RLS forces status='pending', so
 * every submission goes through the moderator review queue before it is
 * listed publicly.
 */
export async function submitGame(
  input: SubmitGameInput,
  gameId?: string,
): Promise<ActionResult<{ gameId: string }>> {
  const parsed = submitGameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid game.",
    };
  }

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const row = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    emoji: parsed.data.emoji,
    code: parsed.data.code,
    status: "pending" as const,
    review_note: null,
  };

  if (gameId) {
    // Author edit — RLS restricts to own rows and forces re-review.
    const { error } = await supabase
      .from("games")
      .update(row)
      .eq("id", gameId)
      .eq("author_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/games");
    return { ok: true, data: { gameId } };
  }

  const { data, error } = await supabase
    .from("games")
    .insert({ ...row, author_id: userId })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/games");
  return { ok: true, data: { gameId: data.id } };
}

/**
 * Approve or reject a game. Runs through the user client so the moderator
 * RLS policy is what grants the write — no service role involved.
 */
export async function reviewGame(
  gameId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .update({
      status: decision,
      review_note: note?.trim().slice(0, 500) || null,
    })
    .eq("id", gameId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not allowed." };
  revalidatePath("/admin/games");
  revalidatePath("/games");
  return { ok: true, data: undefined };
}

/** Delete a game (author or moderator — enforced by RLS). */
export async function deleteGame(gameId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/games");
  revalidatePath("/admin/games");
  return { ok: true, data: undefined };
}

/** Count one play of an approved game (definer RPC, fire-and-forget). */
export async function recordGamePlay(gameId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const supabase = await createClient();
  await supabase.rpc("record_game_play", { gid: gameId });
}

const REACTION_KINDS = ["like", "love", "fun", "interested", "wow"] as const;

/** Set (or clear, when kind is null) the caller's reaction to a game. */
export async function setGameReaction(
  gameId: string,
  kind: (typeof REACTION_KINDS)[number] | null,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  if (kind === null) {
    const { error } = await supabase
      .from("game_reactions")
      .delete()
      .match({ game_id: gameId, user_id: userId });
    if (error) return { ok: false, error: error.message };
  } else {
    if (!REACTION_KINDS.includes(kind))
      return { ok: false, error: "Invalid reaction." };
    const { error } = await supabase
      .from("game_reactions")
      .upsert(
        { game_id: gameId, user_id: userId, kind },
        { onConflict: "game_id,user_id" },
      );
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/games/${gameId}`);
  return { ok: true, data: undefined };
}

/** Post a comment on a game. */
export async function addGameComment(
  gameId: string,
  body: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const clean = body.trim();
  if (!clean || clean.length > 1000)
    return { ok: false, error: "မှတ်ချက် ၁–၁၀၀၀ လုံး ဖြစ်ရမည်။" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_comments")
    .insert({ game_id: gameId, user_id: userId, body: clean });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/games/${gameId}`);
  return { ok: true, data: undefined };
}

/** Delete one of the caller's own comments (moderators may delete any). */
export async function deleteGameComment(
  commentId: string,
  gameId: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/games/${gameId}`);
  return { ok: true, data: undefined };
}
