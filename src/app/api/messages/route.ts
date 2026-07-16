import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import { getMessages } from "@/lib/db/messages";

/** GET /api/messages?conversation=<id> — last 100 messages, oldest first. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversation");
  if (!conversationId) {
    return NextResponse.json(
      { error: "Missing conversation parameter" },
      { status: 400 },
    );
  }

  try {
    const messages = await getMessages(conversationId);
    return NextResponse.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
