import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
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

  await Promise.all(
    rows
      .filter((row) => row.user_id !== claims.sub)
      .map((row) =>
        sendPushToUser(row.user_id, {
          title: parsed.data.video ? `📹 ${name}` : `📞 ${name}`,
          body: parsed.data.video
            ? "Video call ခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ"
            : "ဖုန်းခေါ်နေသည် — ဖွင့်ပြီး ဖြေပါ",
          url: "/messages",
          tag: "gw-incoming-call",
        }),
      ),
  );
  return NextResponse.json({ ok: true });
}
