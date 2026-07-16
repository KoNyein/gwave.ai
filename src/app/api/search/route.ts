import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import { quickSearchKnowledge } from "@/lib/db/knowledge";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const user = await getCurrentUser();

  const escaped = query.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const [knowledge, usersRes, postsRes] = await Promise.all([
    quickSearchKnowledge(query, 5),
    user
      ? supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
          .not("username", "is", null)
          .limit(5)
      : Promise.resolve({ data: [] }),
    user
      ? supabase
          .from("posts")
          .select(
            "id, content, author:profiles!posts_author_id_fkey(username, full_name)",
          )
          .ilike("content", pattern)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    users: usersRes.data ?? [],
    posts: postsRes.data ?? [],
    strains: knowledge.strains,
    minerals: knowledge.minerals,
  });
}
