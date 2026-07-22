import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(4).max(12),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

/**
 * POST /api/mobile/ptt/join — join a walkie-talkie channel by its join code.
 *
 * The native app talks to PostgREST directly for everything else, but joining
 * by code needs the service role: a non-member can't see the channel row under
 * RLS to resolve the code (mirrors the web's joinPttChannel server action).
 */
export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid code." }, { status: 400 });
  }
  const code = parsed.data.code.toUpperCase();

  const admin = createAdminClient();
  const { data: channel } = await admin
    .from("ptt_channels")
    .select("id")
    .eq("join_code", code)
    .maybeSingle();
  if (!channel) {
    return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  }

  const { error } = await admin
    .from("ptt_channel_members")
    .upsert(
      { channel_id: channel.id, user_id: claims.sub },
      { onConflict: "channel_id,user_id" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: channel.id });
}
