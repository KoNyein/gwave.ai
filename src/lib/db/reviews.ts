import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  LeaderboardEntry,
  Review,
  ReviewStats,
  ReviewSubject,
} from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface ReviewWithAuthor extends Review {
  author: AuthorSummary;
}

const AUTHOR_SELECT = "id, username, full_name, avatar_url, role";

/** Recent reviews for a subject, newest first, with the reviewer embedded. */
export async function getReviews(
  subjectType: ReviewSubject,
  subjectId: string,
  limit = 30,
): Promise<ReviewWithAuthor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select(`*, author:profiles!reviews_reviewer_id_fkey(${AUTHOR_SELECT})`)
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<ReviewWithAuthor[]>();
  return data ?? [];
}

/** Count + average rating for a subject. */
export async function getReviewStats(
  subjectType: ReviewSubject,
  subjectId: string,
): Promise<ReviewStats> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("review_stats", {
    p_subject_type: subjectType,
    p_subject_id: subjectId,
  });
  const rows = (data as { rating_count: number; rating_avg: number }[] | null) ?? [];
  const row = rows[0];
  return {
    rating_count: Number(row?.rating_count ?? 0),
    rating_avg: Number(row?.rating_avg ?? 0),
  };
}

/** The caller's own review of a subject, if any. */
export async function getMyReview(
  subjectType: ReviewSubject,
  subjectId: string,
): Promise<Review | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .eq("reviewer_id", user.id)
    .maybeSingle<Review>();
  return data ?? null;
}

interface LbRow {
  subject_id: string;
  rating_count: number;
  rating_avg: number;
  score: number;
}

/**
 * Top-rated subjects of a type, with display info resolved for rendering.
 * Only "page" and "shop_product" are surfaced in the UI.
 */
export async function getLeaderboard(
  subjectType: Exclude<ReviewSubject, "profile">,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("review_leaderboard", {
    p_subject_type: subjectType,
    p_limit: limit,
    p_min_reviews: 1,
  });
  const rows = (data as LbRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.subject_id);
  const display = new Map<string, { title: string; image: string | null; href: string }>();

  if (subjectType === "page") {
    const { data: pages } = await supabase
      .from("pages")
      .select("id, name, slug, avatar_url")
      .in("id", ids)
      .returns<{ id: string; name: string; slug: string; avatar_url: string | null }[]>();
    for (const p of pages ?? []) {
      display.set(p.id, { title: p.name, image: p.avatar_url, href: `/pages/${p.slug}` });
    }
  } else {
    const { data: products } = await supabase
      .from("shop_products")
      .select("id, title, image_url")
      .in("id", ids)
      .returns<{ id: string; title: string; image_url: string | null }[]>();
    for (const p of products ?? []) {
      display.set(p.id, { title: p.title, image: p.image_url, href: `/shop/${p.id}` });
    }
  }

  return rows
    .filter((r) => display.has(r.subject_id))
    .map((r) => {
      const d = display.get(r.subject_id)!;
      return {
        subjectId: r.subject_id,
        ratingCount: Number(r.rating_count),
        ratingAvg: Number(r.rating_avg),
        score: Number(r.score),
        title: d.title,
        image: d.image,
        href: d.href,
      };
    });
}
