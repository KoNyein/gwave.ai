import "server-only";
import { getCurrentUser } from "@/lib/auth";

import { publicEnv } from "@/lib/env";
import { rankItems } from "@/lib/feed/rank";
import { createClient } from "@/lib/supabase/server";
import type {
  CreatorEarning,
  CreatorStatBucket,
  CreatorSummary,
  Reel,
  ReelWithAuthor,
} from "@/types/database";

/** Public URL for a file in the public "media" bucket. */
function mediaUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

type ReelRow = Reel & {
  author: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

async function decorate(
  rows: ReelRow[],
  userId: string | null,
): Promise<ReelWithAuthor[]> {
  let liked = new Set<string>();
  if (userId && rows.length) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("reel_likes")
      .select("reel_id")
      .eq("user_id", userId)
      .in("reel_id", rows.map((r) => r.id));
    liked = new Set((data ?? []).map((l) => (l as { reel_id: string }).reel_id));
  }
  return rows.map((r) => ({
    ...r,
    author: r.author ?? {
      id: r.owner_id,
      username: null,
      full_name: null,
      avatar_url: null,
    },
    video_url: mediaUrl(r.video_path),
    liked_by_me: liked.has(r.id),
  }));
}

const SELECT =
  "*, author:profiles!reels_owner_id_fkey(id, username, full_name, avatar_url)";

/**
 * The public "For You" reel feed — a recent pool ranked by recency, engagement
 * (likes + watch minutes) and whether the viewer follows the creator.
 */
export async function getReelsFeed(limit = 20): Promise<ReelWithAuthor[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Pull a bounded recent pool, then rank it.
  const { data } = await supabase
    .from("reels")
    .select(SELECT)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, 60));
  const pool = (data ?? []) as unknown as ReelRow[];

  // Who does the viewer follow? (affinity boost)
  let followIds = new Set<string>();
  if (user) {
    const { data: follows } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", user.id);
    followIds = new Set((follows ?? []).map((f) => (f as { followee_id: string }).followee_id));
  }

  const ranked = rankItems(
    pool.map((r) => ({
      ...r,
      // Map reel signals onto the shared ranker: owner → author (affinity),
      // likes → reactions, watch minutes → a strong (share-weighted) signal.
      author_id: r.owner_id,
      reaction_count: r.like_count,
      comment_count: 0,
      share_count: Math.round((r.watch_seconds ?? 0) / 60),
      hasMedia: true,
    })),
    {
      now: Date.now(),
      selfId: user?.id ?? "",
      friendIds: new Set<string>(),
      followIds,
    },
  );

  return decorate(ranked.slice(0, limit) as unknown as ReelRow[], user?.id ?? null);
}

/** The caller's own reels, newest first. */
export async function getMyReels(): Promise<ReelWithAuthor[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from("reels")
    .select(SELECT)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  return decorate((data ?? []) as unknown as ReelRow[], user.id);
}

/** Creator earnings + engagement totals for the current user. */
export async function getCreatorSummary(): Promise<CreatorSummary> {
  const empty: CreatorSummary = {
    reelCount: 0,
    totalViews: 0,
    totalLikes: 0,
    totalWatchSeconds: 0,
    totalEarned: 0,
    balance: 0,
  };
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return empty;

  const [{ data: reels }, { data: earnings }] = await Promise.all([
    supabase
      .from("reels")
      .select("view_count, like_count, watch_seconds")
      .eq("owner_id", user.id)
      .returns<Pick<Reel, "view_count" | "like_count" | "watch_seconds">[]>(),
    supabase
      .from("creator_earnings")
      .select("amount_mmk, paid_out")
      .eq("user_id", user.id)
      .returns<Pick<CreatorEarning, "amount_mmk" | "paid_out">[]>(),
  ]);

  const r = reels ?? [];
  const e = earnings ?? [];
  return {
    reelCount: r.length,
    totalViews: r.reduce((s, x) => s + (x.view_count ?? 0), 0),
    totalLikes: r.reduce((s, x) => s + (x.like_count ?? 0), 0),
    totalWatchSeconds: r.reduce((s, x) => s + Number(x.watch_seconds ?? 0), 0),
    totalEarned: e.reduce((s, x) => s + Number(x.amount_mmk ?? 0), 0),
    balance: e
      .filter((x) => !x.paid_out)
      .reduce((s, x) => s + Number(x.amount_mmk ?? 0), 0),
  };
}

interface StatRow {
  day?: string;
  month?: string;
  views: number;
  likes: number;
  watch_seconds: number;
  earnings: number;
}

function toBucket(row: StatRow): CreatorStatBucket {
  return {
    period: String(row.day ?? row.month ?? ""),
    views: Number(row.views ?? 0),
    likes: Number(row.likes ?? 0),
    watchSeconds: Number(row.watch_seconds ?? 0),
    earnings: Number(row.earnings ?? 0),
  };
}

/** Per-day creator analytics (Myanmar time) for the last `days` days. */
export async function getCreatorDailyStats(days = 30): Promise<CreatorStatBucket[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("creator_daily_stats", { p_days: days });
  return ((data as StatRow[] | null) ?? []).map(toBucket);
}

/** Per-month creator analytics for the last `months` months. */
export async function getCreatorMonthlyStats(months = 12): Promise<CreatorStatBucket[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("creator_monthly_stats", {
    p_months: months,
  });
  return ((data as StatRow[] | null) ?? []).map(toBucket);
}
