"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";

const createStorySchema = z.object({
  mediaPath: z.string().min(1).max(500),
  mediaType: z.enum(["image", "video"]),
  textOverlay: z.string().max(200).nullable(),
});

export async function createStory(
  input: z.infer<typeof createStorySchema>,
): Promise<ActionResult> {
  const parsed = createStorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid story." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.from("stories").insert({
    author_id: user.id,
    media_path: parsed.data.mediaPath,
    media_type: parsed.data.mediaType,
    text_overlay: parsed.data.textOverlay?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/feed");
  return { ok: true, data: undefined };
}

export async function deleteStory(storyId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(storyId).success) {
    return { ok: false, error: "Invalid story." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/feed");
  return { ok: true, data: undefined };
}

export async function markStoryViewed(storyId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(storyId).success) {
    return { ok: false, error: "Invalid story." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.from("story_views").insert({
    story_id: storyId,
    viewer_id: user.id,
  });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
