import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/push/register — the Flutter app registers its Firebase Cloud
 * Messaging device token so the server can ring it (incoming calls) even when
 * the app is fully closed. Idempotent on the token: a token always maps to the
 * current owner (re-binds if the same device signs into a different account),
 * and `updated_at` bumps so stale tokens can be aged out later.
 *
 * Unregister (e.g. on sign-out) by POSTing `{ token, remove: true }`.
 */
const schema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["android", "ios"]).optional().default("android"),
  remove: z.boolean().optional(),
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
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (parsed.data.remove) {
    // Only drop the row if it belongs to the caller (don't let one account
    // unregister another device's token).
    await admin
      .from("device_tokens")
      .delete()
      .eq("token", parsed.data.token)
      .eq("user_id", claims.sub);
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin
    .from("device_tokens")
    .upsert(
      {
        user_id: claims.sub,
        token: parsed.data.token,
        platform: parsed.data.platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
