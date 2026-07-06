import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  decodeCursor,
  encodeCursor,
  type CommentWithAuthor,
  type FeedPage,
  type FeedPost,
} from "@/types/social";

export const FEED_PAGE_SIZE = 10;

const AUTHOR_SELECT = "id, username, full_name, avatar_url";

/** Everything a post card needs, in a single query. */
const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}),
  media:post_media(*),
  my_reaction:reactions(type),
  shared_post:posts!posts_shared_post_id_fkey(
    *,
    author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}),
    media:post_media(*)
  ),
  group:groups!posts_group_id_fkey(id, name, slug),
  page:pages!posts_page_id_fkey(id, name, slug, avatar_url)
`;

function sortMedia(post: FeedPost): FeedPost {
  post.media.sort((a, b) => a.position - b.position);
  if (post.shared_post) {
    post.shared_post.media.sort((a, b) => a.position - b.position);
  }
  return post;
}

/** Applies a keyset pagination filter for (created_at desc, id desc). */
function applyCursor<T extends { or: (filter: string) => T }>(
  query: T,
  cursor: string | null,
): T {
  if (!cursor) return query;
  const decoded = decodeCursor(cursor);
  if (!decoded) return query;
  return query.or(
    `created_at.lt."${decoded.createdAt}",and(created_at.eq."${decoded.createdAt}",id.lt.${decoded.id})`,
  );
}

function toPage(posts: FeedPost[], limit: number): FeedPage {
  const hasMore = posts.length > limit;
  const page = posts.slice(0, limit).map(sortMedia);
  const last = page[page.length - 1];
  return {
    posts: page,
    nextCursor:
      hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  };
}

/**
 * Everyone whose posts appear in the viewer's feed: self + accepted friends
 * + followed users.
 */
export async function getFeedAuthorIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const [friendshipsRes, followsRes] = await Promise.all([
    supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    supabase.from("follows").select("followee_id").eq("follower_id", userId),
  ]);

  const ids = new Set<string>([userId]);
  for (const f of friendshipsRes.data ?? []) {
    ids.add(f.requester_id);
    ids.add(f.addressee_id);
  }
  for (const f of followsRes.data ?? []) {
    ids.add(f.followee_id);
  }
  return [...ids];
}

/** Cursor-paginated news feed for the given viewer. RLS enforces visibility. */
export async function getFeed(
  userId: string,
  cursor: string | null = null,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const supabase = await createClient();
  const authorIds = await getFeedAuthorIds(userId);

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .in("author_id", authorIds)
    .eq("my_reaction.user_id", userId);
  query = applyCursor(query, cursor);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1)
    .returns<FeedPost[]>();

  if (error) throw new Error(`Failed to load feed: ${error.message}`);
  return toPage(data ?? [], limit);
}

/**
 * Cursor-paginated timeline for a single profile (personal posts only —
 * group and page posts stay in their own feeds). RLS enforces visibility.
 */
export async function getProfilePosts(
  profileId: string,
  viewerId: string,
  cursor: string | null = null,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", profileId)
    .is("group_id", null)
    .is("page_id", null)
    .eq("my_reaction.user_id", viewerId);
  query = applyCursor(query, cursor);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1)
    .returns<FeedPost[]>();

  if (error) throw new Error(`Failed to load posts: ${error.message}`);
  return toPage(data ?? [], limit);
}

/** Cursor-paginated posts inside a group. RLS enforces group privacy. */
export async function getGroupPosts(
  groupId: string,
  viewerId: string,
  cursor: string | null = null,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("group_id", groupId)
    .eq("my_reaction.user_id", viewerId);
  query = applyCursor(query, cursor);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1)
    .returns<FeedPost[]>();

  if (error) throw new Error(`Failed to load group posts: ${error.message}`);
  return toPage(data ?? [], limit);
}

/** Cursor-paginated posts published by a page. */
export async function getPagePosts(
  pageId: string,
  viewerId: string,
  cursor: string | null = null,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("page_id", pageId)
    .eq("my_reaction.user_id", viewerId);
  query = applyCursor(query, cursor);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1)
    .returns<FeedPost[]>();

  if (error) throw new Error(`Failed to load page posts: ${error.message}`);
  return toPage(data ?? [], limit);
}

/** A single post with card relations (for permalinks / after-share refresh). */
export async function getPost(
  postId: string,
  viewerId: string,
): Promise<FeedPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .eq("my_reaction.user_id", viewerId)
    .maybeSingle<FeedPost>();

  if (error) throw new Error(`Failed to load post: ${error.message}`);
  return data ? sortMedia(data) : null;
}

/**
 * All comments for a post (oldest first), with the viewer's own reaction
 * embedded. The UI groups replies under their parents.
 */
export async function getComments(
  postId: string,
  viewerId: string,
): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      `*, author:profiles!comments_author_id_fkey(${AUTHOR_SELECT}), my_reaction:reactions(type)`,
    )
    .eq("post_id", postId)
    .eq("my_reaction.user_id", viewerId)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<CommentWithAuthor[]>();

  if (error) throw new Error(`Failed to load comments: ${error.message}`);
  return data ?? [];
}
