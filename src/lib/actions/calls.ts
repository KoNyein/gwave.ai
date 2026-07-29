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
        // A ring is only meaningful during the 45s ring window — TTL it so a
        // delayed delivery can't pop a stale incoming-call alert later.
        ttl: "45s",
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

/**
 * Server-side relay for the web client's per-call signaling sends (accept /
 * offer / answer / ice / decline / hangup / cancel).
 *
 * Field debugging showed the self-hosted Realtime can silently drop
 * broadcasts SENT over a client websocket while receives keep working — the
 * app's sends were moved to /api/mobile/call/signal for exactly this reason,
 * which is why app-side hangup/accept became reliable while browser-sent
 * offers/ICE still vanished and calls hung at "Connecting". Relaying the web
 * sends through the server closes that last flaky leg AND puts the whole
 * handshake into one server log stream ([call/signal-web] + [call/signal]).
 *
 * The payload is tagged `_from` so both clients can drop the echo of their
 * own relayed messages (broadcasts are delivered to every subscriber,
 * including the sender). Same trust model as the app endpoint: any authed
 * user can broadcast to an unguessable call UUID — accepted pre-launch.
 */
export async function relayCallSignal(
  callId: string,
  event:
    | "accept"
    | "offer"
    | "answer"
    | "ice"
    | "decline"
    | "hangup"
    | "cancel",
  payload: Record<string, unknown> = {},
  ringUserId?: string,
): Promise<{ ok: boolean }> {
  const me = await getCurrentUser();
  if (!me || typeof callId !== "string" || callId.length < 6) {
    return { ok: false };
  }
  const tagged = { ...payload, _from: me.id };
  const ok = await serverBroadcast(`call:${callId}`, event, tagged);
  // A cancel must also reach the callee's personal ring inbox, where the
  // pre-answer ring UI lives.
  if (event === "cancel" && ringUserId) {
    await serverBroadcast(`calls:${ringUserId}`, "cancel", {
      ...tagged,
      callId,
    });
  }
  console.log(
    `[call/signal-web] from=${me.id} call=${callId} event=${event} ok=${ok}`,
  );
  return { ok };
}
