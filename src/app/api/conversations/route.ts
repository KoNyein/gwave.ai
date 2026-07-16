import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import { getConversations } from "@/lib/db/messages";

/** GET /api/conversations — the viewer's conversation list. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversations = await getConversations(user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
