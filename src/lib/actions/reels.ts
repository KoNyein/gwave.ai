"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

const createSchema = z.object({
  video_path: z.string().trim().min(3).max(300),
  poster_path: z.string().trim().max(300).nullish(),
  caption: z.string().trim().max(500).nullish(),
  /**
   * The creator confirms this is their own original work that has not been
   * posted on any other platform — required for the reel to earn money.
   */
  original_confirmed: z.boolean().optional(),
});

/** Create a reel from an already-uploaded video (path in the media bucket). */
export async function createReel(
  input: z.input<typeof createSchema>,
): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid reel details." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("reels").insert({
    owner_id: userId,
    video_path: parsed.data.video_path,
    poster_path: parsed.data.poster_path ?? null,
    caption: parsed.data.caption ?? null,
    original_confirmed: parsed.data.original_confirmed === true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reels");
  return { ok: true, data: undefined };
}

/** Record a unique view (fire-and-forget; failures are non-fatal). */
export async function recordReelView(reelId: string): Promise<void> {
  if (!reelId) return;
  const supabase = await createClient();
  await supabase.rpc("record_reel_view", { p_reel: reelId });
}

/**
 * Record a chunk of watch time (seconds) for a reel. Fire-and-forget; the RPC
 * clamps the value server-side so it can't over-credit.
 */
export async function recordReelWatch(
  reelId: string,
  seconds: number,
): Promise<void> {
  if (!reelId || !Number.isFinite(seconds) || seconds <= 0) return;
  const supabase = await createClient();
  await supabase.rpc("record_reel_watch", {
    p_reel: reelId,
    p_seconds: Math.round(seconds),
  });
}

/** Toggle the caller's like on a reel; returns the new liked state. */
export async function toggleReelLike(
  reelId: string,
): Promise<ActionResult<boolean>> {
  if (!reelId) return { ok: false, error: "Missing reel." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_reel_like", {
    p_reel: reelId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: Boolean(data) };
}

/** Delete one of the caller's own reels. */
export async function deleteReel(reelId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reels")
    .delete()
    .eq("id", reelId)
    .eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reels");
  return { ok: true, data: undefined };
}

/** Move unpaid reel earnings into the caller's active G-Pay wallet. */
export async function withdrawEarnings(): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_reel_earnings");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reels");
  revalidatePath("/gpay");
  return { ok: true, data: Number(data ?? 0) };
}
