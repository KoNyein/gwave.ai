import { NextRequest, NextResponse } from "next/server";

import { getMessages } from "@/lib/db/messages";
import { createClient } from "@/lib/supabase/server";

/** GET /api/messages?conversation=<id> — last 100 messages, oldest first. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
