import "server-only";

import { SPONSORED_SLOT } from "@/lib/ads/rank";
import { pickBoostForFeed } from "@/lib/db/boosts";
import { createClient } from "@/lib/data/server";
import { rankItems } from "@/lib/feed/rank";
import {
  decodeCursor,
  encodeCursor,
  type CommentWithAuthor,
  type FeedPage,
  type FeedPost,
} from "@/types/social";

export const FEED_PAGE_SIZE = 10;

const AUTHOR_SELECT = "id, username, full_name, avatar_url, role";

/** Everything a post card needs, in a single query. */
const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}),
  media:post_media(*),
  my_reaction:reactions(type),
  shared_post:posts!shared_post_id(
      *,
      author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}),
    media:post_media(*)
  ),
  group:groups!posts_group_id_fkey(id, name, slug),
  page:pages!posts_page_id_fkey(id, name, slug, avatar_url)
`;

/** Placeholder author when the profile embed comes back empty (deleted or
 *  hidden profile) — the card renders a plain name instead of crashing. */
function fallbackAuthor(authorId: string) {
  return {
    id: authorId,
    username: "",
    full_name: "အသုံးပြုသူ",
    avatar_url: null,
    role: "user",
  } as FeedPost["author"];
}

function sortMedia(post: FeedPost): FeedPost {
  // PostgREST can omit an embed entirely (e.g. right after a schema change,
  // before its cache reloads) or return a null author (deleted/hidden
  // profile) — a post must degrade gracefully, never crash the whole feed.
  //
  // The self-referencing shared_post embed may also arrive as an ARRAY
  // (PostgREST resolves the self-join as to-many on some versions) — an
  // empty [] is truthy and rendered a phantom "shared post" block with no
  // author/date, and [].media crashed the feed. Coerce to object-or-null.
  const sp = post.shared_post as unknown;
  post.shared_post = Array.isArray(sp)
    ? ((sp[0] ?? null) as FeedPost["shared_post"])
    : ((sp ?? null) as FeedPost["shared_post"]);
  post.media = (post.media ?? []).sort((a, b) => a.position - b.position);
  if (!post.author) post.author = fallbackAuthor(post.author_id);
  post.my_reaction = post.my_reaction ?? [];
  if (post.shared_post) {
    post.shared_post.media = (post.shared_post.media ?? []).sort(
      (a, b) => a.position - b.position,
    );
    if (!post.shared_post.author) {
      post.shared_post.author = fallbackAuthor(post.shared_post.author_id);
    }
  }
  return post;
}

/**
 * View counts are author-only, but the column rides along in `select *`
 * rows readable by every allowed viewer — so zero it out server-side for
 * anyone who isn't the author, instead of merely hiding it in the UI.
 */
function hideForeignViewCounts(post: FeedPost, viewerId: string): FeedPost {
  if (post.author_id !== viewerId) post.view_count = 0;
  if (post.shared_post && post.shared_post.author_id !== viewerId) {
    post.shared_post.view_count = 0;
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

function toPage(posts: FeedPost[], limit: number, viewerId: string): FeedPage {
  const hasMore = posts.length > limit;
  const page = posts
    .slice(0, limit)
    .map(sortMedia)
    .map((post) => hideForeignViewCounts(post, viewerId));
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
interface FeedGraph {
  authorIds: string[];
  friendIds: Set<string>;
  followIds: Set<string>;
}

/** The viewer's social graph: accepted friends and followed users. */
async function getFeedGraph(userId: string): Promise<FeedGraph> {
  const db = await createClient();
  const [friendshipsRes, followsRes] = await Promise.all([
    db
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    db.from("follows").select("followee_id").eq("follower_id", userId),
  ]);

  const friendIds = new Set<string>();
  for (const f of friendshipsRes.data ?? []) {
    if (f.requester_id !== userId) friendIds.add(f.requester_id);
    if (f.addressee_id !== userId) friendIds.add(f.addressee_id);
  }
  const followIds = new Set<string>();
  for (const f of followsRes.data ?? []) followIds.add(f.followee_id);

  return {
    authorIds: [...new Set<string>([userId, ...friendIds, ...followIds])],
    friendIds,
    followIds,
  };
}

/** Everyone whose posts appear in the viewer's feed (self + friends + follows). */
export async function getFeedAuthorIds(userId: string): Promise<string[]> {
  return (await getFeedGraph(userId)).authorIds;
}

// The personalized "For You" feed ranks a bounded pool of the most recent
// posts by recency + engagement + affinity (phase 1); once that pool is
// exhausted it falls back to a chronological trail of older posts (phase 2).
// The cursor encodes the phase: "r:<offset>" while ranking, "c:<keyset>" after.
const RANKED_POOL = 300;

function chronoCursor(post: FeedPost): string {
  return `c:${encodeCursor(post.created_at, post.id)}`;
}

/**
 * Splice one *Sponsored* post into a freshly-loaded first page: run the boost
 * auction, fetch the winning campaign's post (RLS still applies), and place it
 * at SPONSORED_SLOT. Skipped silently if there's no eligible ad or the promoted
 * post isn't visible to this viewer. Billing happens client-side on view.
 */
async function injectSponsoredPost(
  posts: FeedPost[],
  viewerId: string,
): Promise<FeedPost[]> {
  if (posts.length === 0) return posts;
  const winner = await pickBoostForFeed("post");
  if (!winner) return posts;
  // Don't show a promo for a post already on screen.
  if (posts.some((p) => p.id === winner.target_id)) return posts;

  const db = await createClient();
  const { data } = await db
    .from("posts")
    .select(POST_SELECT)
    .eq("id", winner.target_id)
    .eq("my_reaction.user_id", viewerId)
    .maybeSingle<FeedPost>();
  if (!data) return posts;

  const ad = hideForeignViewCounts(sortMedia(data), viewerId);
  ad.sponsored = true;
  ad.boost_id = winner.id;
  ad.boost_headline = winner.headline;

  const slot = Math.min(SPONSORED_SLOT, posts.length);
  return [...posts.slice(0, slot), ad, ...posts.slice(slot)];
}

// Discovery: how many public video / live posts from outside the viewer's
// graph to blend into the first feed page, and where.
const DISCOVERY_SLOTS = [2, 5, 9];

/**
 * Recent PUBLIC posts carrying a video, or a live announcement, authored by
 * people the viewer doesn't already follow — so everyone's videos and live
 * streams reach the feed (discovery), not just those from your own network.
 * RLS still applies (public posts are readable by all authenticated users).
 */
async function getDiscoveryPosts(
  viewerId: string,
  excludeAuthorIds: Set<string>,
  want: number,
): Promise<FeedPost[]> {
  const db = await createClient();
  // Only look back a couple of weeks so discovery stays fresh and the queries
  // stay bounded.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Post ids that have at least one video attachment (recent first).
  const { data: vidRows } = await db
    .from("post_media")
    .select("post_id, created_at")
    .eq("media_type", "video")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(120)
    .returns<{ post_id: string }[]>();
  const videoIds = [...new Set((vidRows ?? []).map((r) => r.post_id))];

  const [videoRes, liveRes] = await Promise.all([
    videoIds.length > 0
      ? db
          .from("posts")
          .select(POST_SELECT)
          .in("id", videoIds)
          .eq("visibility", "public")
          .is("group_id", null)
          .is("page_id", null)
          .is("removed_at", null)
          .eq("my_reaction.user_id", viewerId)
          .order("created_at", { ascending: false })
          .limit(40)
          .returns<FeedPost[]>()
      : Promise.resolve({ data: [] as FeedPost[] }),
    // Live announcement posts carry a "/live/<id>" link in their content.
    db
      .from("posts")
      .select(POST_SELECT)
      .eq("visibility", "public")
      .is("removed_at", null)
      .ilike("content", "%/live/%")
      .gte("created_at", since)
      .eq("my_reaction.user_id", viewerId)
      .order("created_at", { ascending: false })
      .limit(15)
      .returns<FeedPost[]>(),
  ]);

  const seen = new Set<string>();
  const out: FeedPost[] = [];
  for (const row of [...(videoRes.data ?? []), ...(liveRes.data ?? [])]) {
    if (seen.has(row.id)) continue;
    if (excludeAuthorIds.has(row.author_id)) continue; // already in the graph feed
    seen.add(row.id);
    out.push(row);
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out.slice(0, want);
}

/**
 * Blend a few discovery videos / lives into a freshly-loaded first page at
 * spaced slots (deduped against what's already on screen), so user-posted
 * videos and live streams surface to everyone — the discovery counterpart to
 * the graph feed.
 */
async function injectDiscoveryPosts(
  posts: FeedPost[],
  viewerId: string,
  graph: FeedGraph,
): Promise<FeedPost[]> {
  const onScreen = new Set(posts.map((p) => p.id));
  const exclude = new Set<string>(graph.authorIds);
  const discovery = (
    await getDiscoveryPosts(viewerId, exclude, DISCOVERY_SLOTS.length)
  )
    .filter((p) => !onScreen.has(p.id))
    .map(sortMedia)
    .map((p) => hideForeignViewCounts(p, viewerId));
  if (discovery.length === 0) return posts;

  const out = [...posts];
  let slot = 0;
  for (const d of discovery) {
    (d as unknown as { discovered: boolean }).discovered = true;
    const at = Math.min(DISCOVERY_SLOTS[slot] ?? out.length, out.length);
    out.splice(at, 0, d);
    slot += 1;
  }
  return out;
}

/**
 * Personalized, cursor-paginated news feed. Phase 1 surfaces the best recent
 * posts from the viewer's graph; phase 2 continues chronologically through
 * older history. RLS still enforces visibility.
 */
export async function getFeed(
  userId: string,
  cursor: string | null = null,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const db = await createClient();
  const graph = await getFeedGraph(userId);

  // Phase 2 — chronological continuation.
  if (cursor && cursor.startsWith("c:")) {
    const decoded = decodeCursor(cursor.slice(2));
    let query = db
      .from("posts")
      .select(POST_SELECT)
      .in("author_id", graph.authorIds)
      .eq("my_reaction.user_id", userId);
    if (decoded) {
      query = query.or(
        `created_at.lt."${decoded.createdAt}",and(created_at.eq."${decoded.createdAt}",id.lt.${decoded.id})`,
      );
    }
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1)
      .returns<FeedPost[]>();
    if (error) throw new Error(`Failed to load feed: ${error.message}`);
    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const page = rows
      .slice(0, limit)
      .map(sortMedia)
      .map((p) => hideForeignViewCounts(p, userId));
    const last = page[page.length - 1];
    return { posts: page, nextCursor: hasMore && last ? chronoCursor(last) : null };
  }

  // Phase 1 — ranked recent pool.
  const offset =
    cursor && cursor.startsWith("r:")
      ? Math.max(0, Number.parseInt(cursor.slice(2), 10) || 0)
      : 0;

  const { data, error } = await db
    .from("posts")
    .select(POST_SELECT)
    .in("author_id", graph.authorIds)
    .eq("my_reaction.user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RANKED_POOL)
    .returns<FeedPost[]>();
  if (error) throw new Error(`Failed to load feed: ${error.message}`);

  const pool = data ?? [];
  for (const p of pool) {
    (p as unknown as { hasMedia: boolean }).hasMedia = (p.media?.length ?? 0) > 0;
  }
  const ranked = rankItems(pool, {
    now: Date.now(),
    selfId: userId,
    friendIds: graph.friendIds,
    followIds: graph.followIds,
  });

  let page = ranked
    .slice(offset, offset + limit)
    .map(sortMedia)
    .map((p) => hideForeignViewCounts(p, userId));

  // Only the very first page blends in discovery videos/lives + a Sponsored
  // slot, so they show up front without repeating on every infinite-scroll
  // fetch. Discovery first (best-effort — a hiccup must not break the feed).
  if (offset === 0) {
    try {
      page = await injectDiscoveryPosts(page, userId, graph);
    } catch {
      /* discovery is a bonus; the graph feed still renders. */
    }
    page = await injectSponsoredPost(page, userId);
  }

  let nextCursor: string | null = null;
  if (offset + limit < ranked.length) {
    nextCursor = `r:${offset + limit}`;
  } else if (pool.length >= RANKED_POOL) {
    const oldest = pool[pool.length - 1];
    if (oldest) nextCursor = chronoCursor(oldest);
  }
  return { posts: page, nextCursor };
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
  const db = await createClient();

  let query = db
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
  return toPage(data ?? [], limit, viewerId);
}

/** Cursor-paginated posts inside a group. RLS enforces group privacy. */
export async function getGroupPosts(
  groupId: string,
  viewerId: string,
  cursor: string | null = null,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const db = await createClient();

  let query = db
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
  return toPage(data ?? [], limit, viewerId);
}

/** Cursor-paginated posts published by a page. */
export async function getPagePosts(
  pageId: string,
  viewerId: string,
  cursor: string | null = null,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const db = await createClient();

  let query = db
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
  return toPage(data ?? [], limit, viewerId);
}

/** A single post with card relations (for permalinks / after-share refresh). */
export async function getPost(
  postId: string,
  viewerId: string,
): Promise<FeedPost | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .eq("my_reaction.user_id", viewerId)
    .maybeSingle<FeedPost>();

  if (error) throw new Error(`Failed to load post: ${error.message}`);
  return data ? hideForeignViewCounts(sortMedia(data), viewerId) : null;
}

export interface ProfilePhoto {
  post_id: string;
  storage_path: string;
  created_at: string;
}

/**
 * A user's photos for the profile Photos tab: image media from their
 * personal (non-group, non-page) posts, newest first. RLS on posts keeps
 * private posts hidden from viewers who can't see them.
 */
export async function getProfilePhotos(
  profileId: string,
  limit = 30,
): Promise<ProfilePhoto[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("posts")
    .select("id, created_at, media:post_media(storage_path, media_type, position)")
    .eq("author_id", profileId)
    .is("group_id", null)
    .is("page_id", null)
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<
      {
        id: string;
        created_at: string;
        media: { storage_path: string; media_type: string; position: number }[];
      }[]
    >();

  if (error) throw new Error(`Failed to load photos: ${error.message}`);

  const photos: ProfilePhoto[] = [];
  for (const post of data ?? []) {
    const images = (post.media ?? [])
      .filter((m) => m.media_type === "image")
      .sort((a, b) => a.position - b.position);
    for (const image of images) {
      photos.push({
        post_id: post.id,
        storage_path: image.storage_path,
        created_at: post.created_at,
      });
      if (photos.length >= limit) return photos;
    }
  }
  return photos;
}

/**
 * All comments for a post (oldest first), with the viewer's own reaction
 * embedded. The UI groups replies under their parents.
 */
export async function getComments(
  postId: string,
  viewerId: string,
): Promise<CommentWithAuthor[]> {
  const db = await createClient();
  const { data, error } = await db
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
  return (data ?? []).map((c) => ({
    ...c,
    // Same degradation as posts: a deleted/hidden profile must not crash
    // the thread.
    author: c.author ?? fallbackAuthor(c.author_id),
    my_reaction: c.my_reaction ?? [],
  }));
}
