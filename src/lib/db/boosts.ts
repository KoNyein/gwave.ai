import "server-only";
import { getCurrentUser } from "@/lib/auth";

import { rankAds, type AdCandidate } from "@/lib/ads/rank";
import { createClient } from "@/lib/data/server";
import type {
  Boost,
  BoostDailyStat,
  BoostServeRow,
  BoostTarget,
} from "@/types/database";

/**
 * Pick the winning campaign to show the viewer in a given feed: ask the DB for
 * eligible candidates, run the eCPM + pacing auction, return the top one.
 */
export async function pickBoostForFeed(
  targetType: BoostTarget,
  limit = 10,
): Promise<BoostServeRow | null> {
  const db = await createClient();
  const { data } = await db.rpc("get_feed_boosts", {
    p_target_type: targetType,
    p_limit: limit,
    p_freq_cap: 4,
  });
  const rows = (data as BoostServeRow[] | null) ?? [];
  if (rows.length === 0) return null;
  const ranked = rankAds(rows as unknown as AdCandidate[]);
  return (ranked[0] as unknown as BoostServeRow) ?? null;
}

/** A campaign plus a small preview of whatever it promotes (for the manager). */
export interface BoostWithPreview extends Boost {
  preview: { title: string; image: string | null };
}

async function previewFor(
  db: Awaited<ReturnType<typeof createClient>>,
  b: Boost,
): Promise<{ title: string; image: string | null }> {
  if (b.target_type === "post") {
    const { data } = await db
      .from("posts")
      .select("content")
      .eq("id", b.target_id)
      .maybeSingle<{ content: string }>();
    return { title: data?.content?.slice(0, 80) || "Post", image: null };
  }
  if (b.target_type === "shop_product") {
    const { data } = await db
      .from("shop_products")
      .select("title, image_url")
      .eq("id", b.target_id)
      .maybeSingle<{ title: string; image_url: string | null }>();
    return { title: data?.title || "Product", image: data?.image_url ?? null };
  }
  const { data } = await db
    .from("pos_products")
    .select("name")
    .eq("id", b.target_id)
    .maybeSingle<{ name: string }>();
  return { title: data?.name || "Product", image: null };
}

/** The caller's own campaigns, newest first, each with a target preview. */
export async function getMyBoosts(): Promise<BoostWithPreview[]> {
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await db
    .from("boosts")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Boost[]>();

  const boosts = data ?? [];
  return Promise.all(
    boosts.map(async (b) => ({ ...b, preview: await previewFor(db, b) })),
  );
}

/** Per-day performance of one of the caller's campaigns. */
export async function getBoostDailyStats(
  boostId: string,
  days = 30,
): Promise<BoostDailyStat[]> {
  const db = await createClient();
  const { data } = await db.rpc("boost_daily_stats", {
    p_boost: boostId,
    p_days: days,
  });
  return ((data as BoostDailyStat[] | null) ?? []).map((r) => ({
    day: String(r.day),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spent: Number(r.spent ?? 0),
  }));
}

/** Things the caller can promote — for the "create boost" picker. */
export interface BoostableTargets {
  posts: { id: string; label: string }[];
  shopProducts: { id: string; label: string }[];
  posProducts: { id: string; label: string }[];
}

export async function getBoostableTargets(): Promise<BoostableTargets> {
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { posts: [], shopProducts: [], posProducts: [] };

  const [posts, products, stores] = await Promise.all([
    db
      .from("posts")
      .select("id, content, created_at")
      .eq("author_id", user.id)
      .is("group_id", null)
      .is("page_id", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<{ id: string; content: string }[]>(),
    db
      .from("shop_products")
      .select("id, title")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<{ id: string; title: string }[]>(),
    db
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .returns<{ id: string }[]>(),
  ]);

  let posProducts: { id: string; label: string }[] = [];
  const storeIds = (stores.data ?? []).map((s) => s.id);
  if (storeIds.length) {
    const { data } = await db
      .from("pos_products")
      .select("id, name")
      .in("store_id", storeIds)
      .eq("active", true)
      .limit(100)
      .returns<{ id: string; name: string }[]>();
    posProducts = (data ?? []).map((p) => ({ id: p.id, label: p.name }));
  }

  return {
    posts: (posts.data ?? []).map((p) => ({
      id: p.id,
      label: p.content?.slice(0, 60)?.trim() || "(no text)",
    })),
    shopProducts: (products.data ?? []).map((p) => ({
      id: p.id,
      label: p.title,
    })),
    posProducts,
  };
}
