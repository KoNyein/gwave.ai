import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import { quickSearchKnowledge } from "@/lib/db/knowledge";
import { createAdminClient } from "@/lib/data/admin";
import { createClient } from "@/lib/data/server";

/**
 * GET /api/search?q= — grouped quick results for the navbar dropdown.
 * Strains and minerals are public; people and posts require a session.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (query.length < 2) {
    return NextResponse.json({
      users: [],
      posts: [],
      strains: [],
      minerals: [],
    });
  }

  const db = await createClient();
  const user = await getCurrentUser();

  const escaped = query.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const [knowledge, usersRes, postsRes] = await Promise.all([
    quickSearchKnowledge(query, 5),
    user
      ? db
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
          .not("username", "is", null)
          .limit(5)
      : Promise.resolve({ data: [] }),
    user
      ? db
          .from("posts")
          .select(
            "id, content, author:profiles!posts_author_id_fkey(username, full_name)",
          )
          .ilike("content", pattern)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const users = usersRes.data ?? [];
  const posts = postsRes.data ?? [];
  const total =
    users.length + posts.length + knowledge.strains.length + knowledge.minerals.length;

  // Log the keyword for the admin dashboard. Fire-and-forget and fully
  // swallowed: search must never fail because analytics did, and a missing
  // table (migration not yet run) is not an error.
  void logSearch(
    user?.id ?? null,
    query,
    request.nextUrl.searchParams.get("source") ?? "global",
    total,
  );

  return NextResponse.json({
    users,
    posts,
    strains: knowledge.strains,
    minerals: knowledge.minerals,
  });
}

/**
 * Record what was typed, by whom, from which box, and how many results came
 * back. The zero-result rows are the interesting ones: they are the list of
 * things users wanted and Gwave did not have.
 */
async function logSearch(
  userId: string | null,
  q: string,
  source: string,
  resultCount: number,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("search_queries").insert({
      user_id: userId,
      // Normalised so "OG Kush" and "og kush" group in the dashboard.
      q: q.toLowerCase(),
      source: source.slice(0, 30),
      result_count: resultCount,
    });
  } catch {
    // Analytics is never worth a 500.
  }
}
