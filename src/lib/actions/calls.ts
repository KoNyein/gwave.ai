"use server";

import { getCurrentUser } from "@/lib/auth";
import { sendFcmToUser } from "@/lib/fcm";
import { sendPushToUser } from "@/lib/push";
import { serverBroadcast } from "@/lib/realtime-server";
import { createAdminClient } from "@/lib/data/admin";

/**
 * Notify every other participant of a conversation about an incoming call,
 * beside the caller's own realtime ring broadcast. Three channels, all
 * best-effort:
 *  - web push (VAPID) — a browser with no/backgrounded tab;
 *  - FCM data+notification — the native app; the data payload carries the
 *    full ring (callId + caller identity) so the app can present the
 *    incoming-call screen even when its realtime socket is deaf, which field
 *    debugging showed can happen while the socket still reports "ready";
 *  - a server-side relay of the realtime "ring" itself, so an open tab/app
 *    inbox rings even if the caller's client-side broadcast was lost.
 * `callId` comes from the caller; without it (old clients) the FCM payload
 * degrades to a wake-up and the relay is skipped — exactly the old behavior.
 */
export async function notifyIncomingCall(
  conversationId: string,
  video: boolean,
  callId?: string,
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
    .select("username, full_name, avatar_url")
    .eq("id", me.id)
    .maybeSingle<{
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    }>();
  const name = profile?.full_name || profile?.username || "Gwave";

  const callee = rows.filter((row) => row.user_id !== me.id);
  console.log(
    `[call/notify-web] conv=${conversationId} from=${me.id} ` +
      `callees=${callee.length} callId=${callId ?? "-"} video=${video}`,
  );
  const ringPayload = callId
    ? {
        callId,
        conversationId,
        video,
        from: {
          id: me.id,
          username: profile?.username ?? "",
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
      }
    : null;

  await Promise.all(
    callee.flatMap((row) => [
      ...(ringPayload
        ? [serverBroadcast(`calls:${row.user_id}`, "ring", ringPayload)]
        : []),
      sendPushToUser(row.user_id, {
        title: video ? `📹 ${name}` : `📞 ${name}`,
        body: video
          ? "Video call ခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ"
          : "ဖုန်းခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ",
        url: "/messages",
        tag: "gw-incoming-call",
      }),
      sendFcmToUser(row.user_id, {
        data: {
          type: "call",
          video: video ? "1" : "0",
          conversationId,
          caller: name,
          callerId: me.id,
          ...(profile?.avatar_url ? { callerAvatar: profile.avatar_url } : {}),
          ...(callId ? { callId } : {}),
        },
        notification: {
          title: video ? `📹 ${name}` : `📞 ${name}`,
          body: video
            ? "Video call ခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ"
            : "ဖုန်းခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ",
        },
      }),
    ]),
  );
}
