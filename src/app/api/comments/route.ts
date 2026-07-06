import { NextRequest, NextResponse } from "next/server";

import { getComments } from "@/lib/db/posts";
import { createClient } from "@/lib/supabase/server";

/** GET /api/comments?post=<post id> — all comments for a visible post. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
