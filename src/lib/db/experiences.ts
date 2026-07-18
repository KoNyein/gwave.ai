import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthorSummary } from "@/types/social";

export interface ExperiencePost {
  id: string;
  content: string;
  created_at: string;
  author: AuthorSummary | null;
  media: { id: string; storage_path: string; media_type: "image" | "video" }[];
}

/**
 * Public experience posts for a knowledge item (strain/mineral). Experiences
 * shared from an item's page embed a canonical back-link
 * (`https://gwave.cc/<itemPath>`), which doubles as the join key here — so
 * the item page can show its community experiences comment-style without a
 * separate table.
 */
export async function getExperiencePosts(
  itemPath: string,
  limit = 12,
): Promise<ExperiencePost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      `id, content, created_at,
       author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url, role),
       media:post_media(id, storage_path, media_type)`,
    )
    .eq("visibility", "public")
    .is("group_id", null)
    .ilike("content", `%gwave.cc${itemPath}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as ExperiencePost[];
}
