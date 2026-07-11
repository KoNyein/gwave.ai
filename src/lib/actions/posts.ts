"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ReactionType } from "@/types/database";
import type { PostViewer } from "@/types/social";

const REACTION_TYPES = [
  "like",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
] as const;

const mediaItemSchema = z.object({
  storage_path: z.string().min(1).max(500),
  media_type: z.enum(["image", "video"]),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

const createPostSchema = z
  .object({
    content: z.string().max(10000),
    visibility: z.enum(["public", "friends", "only_me", "members"]),
    media: z.array(mediaItemSchema).max(10),
    groupId: z.string().uuid().nullish(),
    pageId: z.string().uuid().nullish(),
    locationName: z.string().trim().max(120).nullish(),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
  })
  .refine((input) => !(input.groupId && input.pageId), {
    message: "A post cannot belong to both a group and a page.",
  })
  .refine(
    (input) =>
      input.content.trim().length > 0 ||
      input.media.length > 0 ||
      (input.latitude != null && input.longitude != null),
    { message: "A post needs text, media or a location." },
  )
  .refine((input) => (input.latitude == null) === (input.longitude == null), {
    message: "Location needs both coordinates.",
  })
  .refine(
    (input) =>
      input.media.filter((m) => m.media_type === "video").length === 0 ||
      input.media.length === 1,
    { message: "A post can have up to 10 images or a single video." },
  );

export type CreatePostInput = z.infer<typeof createPostSchema>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createPost(
  input: CreatePostInput,
): Promise<ActionResult<{ postId: string }>> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid post.",
    };
  }

  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: userId,
      content: parsed.data.content.trim(),
      // Group/page posts don't carry personal visibility; the group's
      // privacy (or the page being public) governs who sees them.
      visibility:
        parsed.data.groupId || parsed.data.pageId
          ? "public"
          : parsed.data.visibility,
      group_id: parsed.data.groupId ?? null,
      page_id: parsed.data.pageId ?? null,
      location_name: parsed.data.locationName || null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    })
    .select("id")
    .single();
  if (error || !post) {
    return { ok: false, error: error?.message ?? "Failed to create post." };
  }

  if (parsed.data.media.length > 0) {
    const { error: mediaError } = await supabase.from("post_media").insert(
      parsed.data.media.map((m, index) => ({
        post_id: post.id,
        media_type: m.media_type,
        storage_path: m.storage_path,
        width: m.width,
        height: m.height,
        position: index,
      })),
    );
    if (mediaError) {
      await supabase.from("posts").delete().eq("id", post.id);
      return { ok: false, error: mediaError.message };
    }
  }

  revalidatePath("/feed");
  return { ok: true, data: { postId: post.id } };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/feed");
  return { ok: true, data: undefined };
}

const sharePostSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().max(10000),
  visibility: z.enum(["public", "friends", "only_me", "members"]),
});

export async function sharePost(
  input: z.infer<typeof sharePostSchema>,
): Promise<ActionResult<{ postId: string }>> {
  const parsed = sharePostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid share." };

  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  // Sharing a share re-shares the original post.
  const { data: target } = await supabase
    .from("posts")
    .select("id, shared_post_id")
    .eq("id", parsed.data.postId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Post not found." };

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: userId,
      content: parsed.data.content.trim(),
      visibility: parsed.data.visibility,
      shared_post_id: target.shared_post_id ?? target.id,
    })
    .select("id")
    .single();
  if (error || !post) {
    return { ok: false, error: error?.message ?? "Failed to share post." };
  }

  revalidatePath("/feed");
  return { ok: true, data: { postId: post.id } };
}

/**
 * Sets, changes or clears the viewer's reaction on a post or comment.
 * Passing null removes the reaction.
 */
export async function setReaction(
  target: { postId: string } | { commentId: string },
  type: ReactionType | null,
): Promise<ActionResult> {
  if (type !== null && !REACTION_TYPES.includes(type)) {
    return { ok: false, error: "Invalid reaction." };
  }

  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const column = "postId" in target ? "post_id" : "comment_id";
  const targetId = "postId" in target ? target.postId : target.commentId;
  if (!z.string().uuid().safeParse(targetId).success) {
    return { ok: false, error: "Invalid target." };
  }

  if (type === null) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("user_id", userId)
      .eq(column, targetId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  }

  const { data: existing } = await supabase
    .from("reactions")
    .select("id, type")
    .eq("user_id", userId)
    .eq(column, targetId)
    .maybeSingle();

  if (existing) {
    if (existing.type === type) return { ok: true, data: undefined };
    const { error } = await supabase
      .from("reactions")
      .update({ type })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  }

  const { error } = await supabase.from("reactions").insert({
    user_id: userId,
    [column]: targetId,
    type,
  });
  if (error) return { ok: false, error: error.message };

  // Push the post owner (only on a fresh post reaction).
  if ("postId" in target) {
    void (async () => {
      const { data: post } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", target.postId)
        .maybeSingle();
      if (post?.author_id) {
        const { pushSocial } = await import("@/lib/push");
        await pushSocial(
          post.author_id as string,
          userId,
          (n) => `${n} က သင့်ပို့စ်ကို ${type} ပြုလုပ်လိုက်သည်`,
          "/notifications",
        );
      }
    })();
  }
  return { ok: true, data: undefined };
}

const addCommentSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  parentId: z.string().uuid().nullable(),
});

export async function addComment(
  input: z.infer<typeof addCommentSchema>,
): Promise<ActionResult<{ commentId: string }>> {
  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid comment." };

  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      post_id: parsed.data.postId,
      author_id: userId,
      parent_id: parsed.data.parentId,
      content: parsed.data.content.trim(),
    })
    .select("id")
    .single();
  if (error || !comment) {
    return { ok: false, error: error?.message ?? "Failed to comment." };
  }

  // Push the post owner about the new comment.
  void (async () => {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", parsed.data.postId)
      .maybeSingle();
    if (post?.author_id) {
      const { pushSocial } = await import("@/lib/push");
      await pushSocial(
        post.author_id as string,
        userId,
        (n) => `${n} က သင့်ပို့စ်ကို comment ရေးလိုက်သည်`,
        "/notifications",
      );
    }
  })();
  return { ok: true, data: { commentId: comment.id } };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/**
 * Record that the viewer has seen a post. Idempotent (one row per
 * post+viewer); RLS rejects self-views, invisible posts and spoofed viewer
 * ids, so failures are simply ignored.
 */
export async function recordPostView(postId: string): Promise<void> {
  if (!z.string().uuid().safeParse(postId).success) return;
  const userId = await getUserId();
  if (!userId) return;

  const supabase = await createClient();
  await supabase
    .from("post_views")
    .upsert(
      { post_id: postId, viewer_id: userId },
      { onConflict: "post_id,viewer_id", ignoreDuplicates: true },
    );
}

/**
 * Who has seen a post — RLS only returns the full list to the post's author
 * (anyone else gets at most their own row, which we filter out client-side
 * by never showing the dialog on foreign posts).
 */
export async function getPostViewers(
  postId: string,
): Promise<ActionResult<PostViewer[]>> {
  if (!z.string().uuid().safeParse(postId).success) {
    return { ok: false, error: "Invalid post." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_views")
    .select(
      "viewed_at, viewer:profiles!post_views_viewer_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("post_id", postId)
    .order("viewed_at", { ascending: false })
    .limit(200)
    .returns<PostViewer[]>();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

const updatePostSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().max(10000),
  visibility: z.enum(["public", "friends", "only_me", "members"]),
});

/**
 * Edit a post's text and audience. RLS ("Authors can update their own
 * posts") guarantees only the author's rows are touched; media and location
 * are left as-is, matching Facebook's edit behavior.
 */
export async function updatePost(
  input: z.infer<typeof updatePostSchema>,
): Promise<ActionResult> {
  const parsed = updatePostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid edit." };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .update({
      content: parsed.data.content.trim(),
      visibility: parsed.data.visibility,
    })
    .eq("id", parsed.data.postId)
    .eq("author_id", userId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not allowed." };
  revalidatePath("/feed");
  return { ok: true, data: undefined };
}
