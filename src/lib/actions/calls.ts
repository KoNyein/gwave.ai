"use server";

import { getCurrentUser } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/data/admin";

/**
 * Web-push every other participant of a conversation about an incoming call,
 * so a callee whose tab is closed or backgrounded still gets a ringing
 * notification on the phone. Fired by the caller alongside the realtime ring
 * broadcast; best-effort — the in-app ring stays the primary channel.
 */
export async function notifyIncomingCall(
  conversationId: string,
  video: boolean,
): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;

  const admin = createAdminClient();
  const { data: participants } = await admin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId);
  const rows = (participants ?? []) as { user_id: string }[];
  // Only participants may ring a conversation's members.
  if (!rows.some((row) => row.user_id === me.id)) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("username, full_name")
    .eq("id", me.id)
    .maybeSingle<{ username: string; full_name: string | null }>();
  const name = profile?.full_name || profile?.username || "Gwave";

  await Promise.all(
    rows
      .filter((row) => row.user_id !== me.id)
      .map((row) =>
        sendPushToUser(row.user_id, {
          title: video ? `📹 ${name}` : `📞 ${name}`,
          body: video
            ? "Video call ခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ"
            : "ဖုန်းခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ",
          url: "/messages",
          tag: "gw-incoming-call",
        }),
      ),
  );
}
