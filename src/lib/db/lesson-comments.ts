import "server-only";

import { createClient } from "@/lib/data/server";
import type { AuthorSummary } from "@/types/social";

export interface LessonComment {
  id: string;
  track_slug: string;
  lesson_slug: string;
  author_id: string;
  body: string;
  created_at: string;
  author: AuthorSummary;
}

/** A lesson's discussion thread, newest first. RLS-scoped to signed-in users. */
export async function getLessonComments(
  trackSlug: string,
  lessonSlug: string,
): Promise<LessonComment[]> {
  const db = await createClient();
  const { data } = await db
    .from("lesson_comments")
    .select(
      "id, track_slug, lesson_slug, author_id, body, created_at, author:profiles!lesson_comments_author_id_fkey(id, username, full_name, avatar_url, role)",
    )
    .eq("track_slug", trackSlug)
    .eq("lesson_slug", lessonSlug)
    .order("created_at", { ascending: false })
    .returns<LessonComment[]>();
  return data ?? [];
}
