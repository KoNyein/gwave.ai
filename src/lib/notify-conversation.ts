import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Web-push the other participants of a conversation.
 *
 * Lives here rather than in `actions/messages.ts` because that file is a
 * `"use server"` module: every export in one is a callable endpoint, so exporting
 * this from there would hand anyone on the internet a "push arbitrary text to
 * arbitrary users" button. Anything that writes to `messages` outside of
 * `sendMessage()` — live-location shares, for one — needs to call this itself;
 * there is no database trigger behind it.
 */
export async function notifyConversation(
  conversationId: string,
  senderId: string,
  preview: string,
): Promise<void> {
  try {
    // Dynamic: keeps `web-push` (Node-only) out of anything the client compiles.
    const { sendPushToUser } = await import("@/lib/push");
    const supabase = await createClient();
    const [{ data: parts }, { data: sender }] = await Promise.all([
      supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId),
      supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", senderId)
        .maybeSingle(),
    ]);
    const name =
      (sender?.full_name as string | null) ||
      (sender?.username as string | null) ||
      "Someone";
    const recipients = (parts ?? [])
      .map((p) => p.user_id as string)
      .filter((id) => id !== senderId);
    await Promise.all(
      recipients.map((id) =>
        sendPushToUser(id, {
          title: name,
          body: preview.slice(0, 120),
          url: "/messages",
          tag: `msg:${conversationId}`,
        }),
      ),
    );
  } catch {
    /* push is best-effort */
  }
}
