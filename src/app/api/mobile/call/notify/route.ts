import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import { sendFcmToUser } from "@/lib/fcm";
import { sendPushToUser } from "@/lib/push";

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
    .select("username, full_name")
    .eq("id", claims.sub)
    .maybeSingle<{ username: string; full_name: string | null }>();
  const name = profile?.full_name || profile?.username || "Gwave";

  const callee = rows.filter((row) => row.user_id !== claims.sub);
  await Promise.all(
    callee.flatMap((row) => [
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
      // inbox is dead. A high-priority data message wakes the app to ring.
      // No-op until FCM is configured; safe to ship ahead of that.
      sendFcmToUser(row.user_id, {
        data: {
          type: "call",
          video: parsed.data.video ? "1" : "0",
          conversationId: parsed.data.conversationId,
          caller: name,
        },
      }),
    ]),
  );
  return NextResponse.json({ ok: true });
}
