import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Story } from "@/types/database";
import type { AuthorSummary, StoryGroup } from "@/types/social";

interface StoryRow extends Story {
  author: AuthorSummary;
}

/**
 * Active (unexpired) stories visible to the viewer, grouped per author for
 * the story bar. The viewer's own group comes first, then unviewed groups.
 */
export async function getStoryGroups(userId: string): Promise<StoryGroup[]> {
  const supabase = await createClient();
  const [storiesRes, viewsRes] = await Promise.all([
    supabase
      .from("stories")
      .select(
        "*, author:profiles!stories_author_id_fkey(id, username, full_name, avatar_url)",
      )
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(200)
      .returns<StoryRow[]>(),
    supabase.from("story_views").select("story_id").eq("viewer_id", userId),
  ]);

  const viewed = new Set((viewsRes.data ?? []).map((v) => v.story_id));
  const byAuthor = new Map<string, StoryGroup>();

  for (const story of storiesRes.data ?? []) {
    const { author, ...rest } = story;
    // A story whose author profile is gone (deleted/hidden) can't be
    // grouped or opened — skip it rather than crash the story bar.
    if (!author) continue;
    let group = byAuthor.get(author.id);
    if (!group) {
      group = { author, stories: [], allViewed: true };
      byAuthor.set(author.id, group);
    }
    const isViewed = viewed.has(story.id);
    group.stories.push({ ...rest, viewed: isViewed });
    if (!isViewed) group.allViewed = false;
  }

  return [...byAuthor.values()].sort((a, b) => {
    if (a.author.id === userId) return -1;
    if (b.author.id === userId) return 1;
    if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
    const aLast = a.stories[a.stories.length - 1]?.created_at ?? "";
    const bLast = b.stories[b.stories.length - 1]?.created_at ?? "";
    return bLast.localeCompare(aLast);
  });
}
