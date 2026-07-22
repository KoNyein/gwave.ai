import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

// Join-code alphabet without easily-confused characters (matches the web).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function joinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * POST /api/mobile/ptt/create — create a walkie-talkie channel and join it as
 * the owner.
 *
 * The native app talks to PostgREST directly for most things, but creating a
 * channel through the user's RLS client was silently failing on device, so the
 * channel never persisted. Like /join, do the write with the service role: it
 * inserts the channel + owner membership atomically and returns the new row.
 */
export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a channel name." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Retry a couple of times on the (very unlikely) join-code collision.
  type Channel = {
    id: string;
    name: string;
    join_code: string;
    owner_id: string;
  };
  let channel: Channel | null = null;
  for (let attempt = 0; attempt < 4 && !channel; attempt++) {
    const { data, error } = await admin
      .from("ptt_channels")
      .insert({
        name: parsed.data.name,
        join_code: joinCode(),
        owner_id: claims.sub,
      })
      .select("id, name, join_code, owner_id")
      .single();
    if (!error && data) {
      channel = data as unknown as Channel;
      break;
    }
    // 23505 = unique_violation (duplicate join code) — try a new code.
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (!channel) {
    return NextResponse.json(
      { error: "Could not create the channel." },
      { status: 500 },
    );
  }

  const { error: memberError } = await admin
    .from("ptt_channel_members")
    .upsert(
      { channel_id: channel.id, user_id: claims.sub },
      { onConflict: "channel_id,user_id" },
    );
  if (memberError) {
    // Roll back the orphaned channel so a retry starts clean.
    await admin.from("ptt_channels").delete().eq("id", channel.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ channel });
}
