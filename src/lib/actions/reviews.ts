"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

const upsertSchema = z.object({
  subject_type: z.enum(["profile", "page", "shop_product"]),
  subject_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullish(),
});

/** Create or update the caller's review of a subject. */
export async function upsertReview(
  input: z.input<typeof upsertSchema>,
): Promise<ActionResult<string>> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please give a rating of 1–5." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_review", {
    p_subject_type: d.subject_type,
    p_subject_id: d.subject_id,
    p_rating: d.rating,
    p_comment: d.comment ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leaderboard");
  return { ok: true, data: String(data) };
}

/** Delete the caller's own review. */
export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("reviewer_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leaderboard");
  return { ok: true, data: undefined };
}
