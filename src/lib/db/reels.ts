import "server-only";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type {
  CreatorEarning,
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

/** The public reel feed, newest first. */
export async function getReelsFeed(limit = 20): Promise<ReelWithAuthor[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("reels")
    .select(SELECT)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return decorate((data ?? []) as unknown as ReelRow[], user?.id ?? null);
}

/** The caller's own reels, newest first. */
export async function getMyReels(): Promise<ReelWithAuthor[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
