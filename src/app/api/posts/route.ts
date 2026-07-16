import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import {
  getFeed,
  getGroupPosts,
  getPagePosts,
  getProfilePosts,
} from "@/lib/db/posts";

/**
 * GET /api/posts?scope=feed&cursor=...
 * GET /api/posts?scope=profile&author=<profile id>&cursor=...
 * GET /api/posts?scope=group&group=<group id>&cursor=...
 * GET /api/posts?scope=page&page=<page id>&cursor=...
 *
 * Cursor-paginated posts for the infinite feed. RLS enforces visibility.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
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
    if (scope === "group") {
      const groupId = params.get("group");
      if (!groupId) {
        return NextResponse.json(
          { error: "Missing group parameter" },
          { status: 400 },
        );
      }
      const page = await getGroupPosts(groupId, user.id, cursor);
      return NextResponse.json(page);
    }
    if (scope === "page") {
      const pageId = params.get("page");
      if (!pageId) {
        return NextResponse.json(
          { error: "Missing page parameter" },
          { status: 400 },
        );
      }
      const result = await getPagePosts(pageId, user.id, cursor);
      return NextResponse.json(result);
    }
    const page = await getFeed(user.id, cursor);
    return NextResponse.json(page);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load posts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
