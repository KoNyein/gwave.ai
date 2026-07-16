import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import { getComments } from "@/lib/db/posts";

/** GET /api/comments?post=<post id> — all comments for a visible post. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postId = request.nextUrl.searchParams.get("post");
  if (!postId) {
    return NextResponse.json(
      { error: "Missing post parameter" },
      { status: 400 },
    );
  }

  try {
    const comments = await getComments(postId, user.id);
    return NextResponse.json({ comments });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load comments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
