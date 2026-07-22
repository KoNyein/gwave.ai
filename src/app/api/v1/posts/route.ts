import { NextRequest, NextResponse } from "next/server";

import { authenticateApiRequest, parseLimit } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/data/admin";

/** GET /api/v1/posts — recent PUBLIC posts. Scope: read:posts. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, "read:posts");
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("posts")
    .select(
      "id, content, visibility, reaction_count, comment_count, share_count, created_at, author:profiles!posts_author_id_fkey(username, full_name)",
    )
    .eq("visibility", "public")
    .is("group_id", null)
    .order("created_at", { ascending: false })
    .limit(parseLimit(request));

  const status = error ? 500 : 200;
  await auth.log(status);
  if (error) {
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data });
}
