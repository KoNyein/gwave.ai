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

const addSchema = z.object({
  trackSlug: z.string().trim().min(1).max(120),
  lessonSlug: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
});

/** Post a comment under a lesson. */
export async function addLessonComment(
  input: z.infer<typeof addSchema>,
): Promise<ActionResult<{ commentId: string }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid comment." };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_comments")
    .insert({
      track_slug: parsed.data.trackSlug,
      lesson_slug: parsed.data.lessonSlug,
      author_id: userId,
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to comment." };
  }

  revalidatePath(`/learn/${parsed.data.trackSlug}/${parsed.data.lessonSlug}`);
  return { ok: true, data: { commentId: data.id } };
}

/** Delete a comment (author, or an admin — enforced by RLS). */
export async function deleteLessonComment(
  commentId: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lesson_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
