import { NextRequest, NextResponse } from "next/server";

import { getFeed, getProfilePosts } from "@/lib/db/posts";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/posts?scope=feed&cursor=...
 * GET /api/posts?scope=profile&author=<profile id>&cursor=...
 *
 * Cursor-paginated posts for the infinite feed. RLS enforces visibility.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const cursor = params.get("cursor");
  const scope = params.get("scope") ?? "feed";

  try {
    if (scope === "profile") {
      const author = params.get("author");
      if (!author) {
        return NextResponse.json(
          { error: "Missing author parameter" },
          { status: 400 },
        );
      }
      const page = await getProfilePosts(author, user.id, cursor);
      return NextResponse.json(page);
    }
    const page = await getFeed(user.id, cursor);
    return NextResponse.json(page);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load posts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
