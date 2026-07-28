import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import { sendFcmToUser } from "@/lib/fcm";
import { sendPushToUser } from "@/lib/push";
import { serverBroadcast } from "@/lib/realtime-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/call/notify — the app-side twin of the web caller's
 * notifyIncomingCall action: web-push every other participant about an
 * incoming call so a callee on the web still gets a ringing notification
 * even when the realtime broadcast can't reach their tab (closed,
 * backgrounded, or running stale JS). Best-effort alongside the ring.
 */
const schema = z.object({
  conversationId: z.string().uuid(),
  video: z.boolean().optional(),
  // The caller's call id. When present the server ALSO relays the realtime
  // "ring" broadcast (server-side, via the Realtime HTTP API) so a web/app
  // callee still rings when the caller's own socket can't deliver it.
  callId: z.string().min(6).max(120).optional(),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: participants } = await admin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", parsed.data.conversationId);
  const rows = (participants ?? []) as { user_id: string }[];
  // Only participants may ring a conversation's members.
  if (!rows.some((row) => row.user_id === claims.sub)) {
    return NextResponse.json({ error: "Not a participant." }, { status: 403 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("username, full_name, avatar_url")
    .eq("id", claims.sub)
    .maybeSingle<{
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    }>();
  const name = profile?.full_name || profile?.username || "Gwave";

  const callee = rows.filter((row) => row.user_id !== claims.sub);
  console.log(
    `[call/notify] conv=${parsed.data.conversationId} from=${claims.sub} ` +
      `callees=${callee.length} callId=${parsed.data.callId ?? "-"} ` +
      `video=${Boolean(parsed.data.video)}`,
  );
  // Same shape the ring-inbox subscribers (web use-call.ts, app call_service)
  // already parse from the caller's client-side broadcast.
  const ringPayload = parsed.data.callId
    ? {
        callId: parsed.data.callId,
        conversationId: parsed.data.conversationId,
        video: Boolean(parsed.data.video),
        from: {
          id: claims.sub,
          username: profile?.username ?? "",
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
      }
    : null;
  await Promise.all(
    callee.flatMap((row) => [
      // Realtime relay — rings a callee whose inbox IS subscribed (open web
      // tab / open app) even if the caller's own socket failed to deliver the
      // client-side broadcast. Duplicate rings are idempotent on both clients
      // (same callId is ignored while one is already showing).
      ...(ringPayload
        ? [serverBroadcast(`calls:${row.user_id}`, "ring", ringPayload)]
        : []),
      // Web callee (VAPID) — a browser tab that can't get the realtime ring.
      sendPushToUser(row.user_id, {
        title: parsed.data.video ? `📹 ${name}` : `📞 ${name}`,
        body: parsed.data.video
          ? "Video call ခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ"
          : "ဖုန်းခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ",
        url: "/messages",
        tag: "gw-incoming-call",
      }),
      // Native callee (FCM) — a phone whose app is closed, so the realtime ring
      // inbox is dead. The data payload wakes the app when it's foregrounded,
      // and the notification block makes Android show a ringing heads-up /
      // lock-screen notification (with sound) when the app is backgrounded or
      // killed — tapping it opens the app, which reconnects the ring inbox and
      // catches the caller's re-broadcast ring. No-op until FCM is configured.
      sendFcmToUser(row.user_id, {
        // Full ring payload in the data block: the app presents the
        // incoming-call screen straight from the push, so it rings even when
        // its realtime socket is deaf (all values must be strings for FCM).
        data: {
          type: "call",
          video: parsed.data.video ? "1" : "0",
          conversationId: parsed.data.conversationId,
          caller: name,
          callerId: claims.sub,
          ...(profile?.avatar_url ? { callerAvatar: profile.avatar_url } : {}),
          ...(parsed.data.callId ? { callId: parsed.data.callId } : {}),
        },
        notification: {
          title: parsed.data.video ? `📹 ${name}` : `📞 ${name}`,
          body: parsed.data.video
            ? "Video call ခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ"
            : "ဖုန်းခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ",
        },
      }),
    ]),
  );
  return NextResponse.json({ ok: true });
}
