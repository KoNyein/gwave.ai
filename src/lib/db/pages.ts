import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Page } from "@/types/database";

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function isFollowingPage(
  pageId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("page_followers")
    .select("page_id")
    .eq("page_id", pageId)
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

export async function getMyPages(userId: string): Promise<Page[]> {
  const supabase = await createClient();
  const [ownedRes, followedRes] = await Promise.all([
    supabase
      .from("pages")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("page_followers")
      .select("page:pages!page_followers_page_id_fkey(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .returns<{ page: Page }[]>(),
  ]);
  const owned = ownedRes.data ?? [];
  const seen = new Set(owned.map((p) => p.id));
  const followed = (followedRes.data ?? [])
    .map((row) => row.page)
    .filter((p) => !seen.has(p.id));
  return [...owned, ...followed];
}

export async function getDiscoverPages(
  userId: string,
  limit = 20,
): Promise<Page[]> {
  const supabase = await createClient();
  const [{ data: follows }, { data: pages }] = await Promise.all([
    supabase.from("page_followers").select("page_id").eq("user_id", userId),
    supabase
      .from("pages")
      .select("*")
      .order("follower_count", { ascending: false })
      .limit(50),
  ]);
  const known = new Set((follows ?? []).map((f) => f.page_id));
  return (pages ?? [])
    .filter((p) => !known.has(p.id) && p.owner_id !== userId)
    .slice(0, limit);
}
