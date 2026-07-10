// Engagement + recency + affinity ranking for the personalized ("For You")
// news feed and Reels. Pure functions — no DB, no side effects — so they're
// easy to test and safe to reuse on the server.

export interface RankContext {
  /** Epoch ms "now" captured once per request. */
  now: number;
  selfId: string;
  friendIds: Set<string>;
  followIds: Set<string>;
}

/** How many hours until a post's recency weight halves. */
const RECENCY_HALF_LIFE_HOURS = 16;

interface Rankable {
  author_id: string;
  created_at: string;
  reaction_count?: number;
  comment_count?: number;
  share_count?: number;
  hasMedia?: boolean;
}

/**
 * A blended score: fresh posts float up, engagement (reactions/comments/shares)
 * lifts them further, and posts from close connections get an affinity boost.
 */
export function scoreItem(item: Rankable, ctx: RankContext): number {
  const ageHours = Math.max(
    0,
    (ctx.now - new Date(item.created_at).getTime()) / 3_600_000,
  );
  // 1.0 for a brand-new post, halving every RECENCY_HALF_LIFE_HOURS.
  const recency = Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);

  const engagement = Math.log1p(
    (item.reaction_count ?? 0) +
      2 * (item.comment_count ?? 0) +
      3 * (item.share_count ?? 0),
  );

  let affinity = 0;
  if (item.author_id === ctx.selfId) affinity = 0.15;
  else if (ctx.friendIds.has(item.author_id)) affinity = 0.35;
  else if (ctx.followIds.has(item.author_id)) affinity = 0.15;

  const media = item.hasMedia ? 0.1 : 0;

  return recency * 1.0 + engagement * 0.18 + affinity + media;
}

/** Sort a copy of the items by descending score (newest wins ties). */
export function rankItems<T extends Rankable>(
  items: T[],
  ctx: RankContext,
): T[] {
  return items
    .map((item) => ({ item, s: scoreItem(item, ctx) }))
    .sort(
      (a, b) =>
        b.s - a.s ||
        (a.item.created_at < b.item.created_at ? 1 : -1),
    )
    .map((x) => x.item);
}
