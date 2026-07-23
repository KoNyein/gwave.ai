import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import {
  hostPresentInRoom,
  livekitConfigured,
  livekitUrl,
  mintLivekitToken,
} from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/live/token — mint a LiveKit access token so the app can
 * watch a browser-broadcast Live (streams with a `livekit_room`; they have no
 * HLS URL, so the app must join the SFU as a subscriber like the web viewer
 * does). The host gets a publish-capable token; everyone else subscribe-only.
 */
const schema = z.object({ id: z.string().uuid() });

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
    return NextResponse.json({ error: "Invalid stream id." }, { status: 400 });
  }
  if (!livekitConfigured()) {
    return NextResponse.json(
      { error: "Live viewing is not configured." },
      { status: 503 },
    );
  }
  const url = livekitUrl();
  if (!url) {
    return NextResponse.json(
      { error: "Live viewing is not configured." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { data: stream } = await admin
    .from("live_streams")
    .select("id, host_id, status, livekit_room, created_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }
  if (!stream.livekit_room) {
    return NextResponse.json(
      { error: "This stream is not a browser broadcast." },
      { status: 400 },
    );
  }
  if (stream.status === "ended") {
    return NextResponse.json(
      { error: "This broadcast has ended." },
      { status: 410 },
    );
  }

  // Self-heal stale rows: a browser broadcast that died without calling the
  // end API stays `live` forever. If the host is no longer in the room (and
  // the stream isn't brand new — the host may still be joining), mark it
  // ended so it stops appearing in live lists. Viewers never see a dead room.
  const isHost = stream.host_id === claims.sub;
  const ageMs = Date.now() - new Date(stream.created_at as string).getTime();
  if (!isHost && ageMs > 3 * 60_000) {
    const present = await hostPresentInRoom(stream.livekit_room, stream.host_id);
    if (!present) {
      await admin
        .from("live_streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", stream.id)
        .eq("status", "live");
      return NextResponse.json(
        { error: "This broadcast has ended." },
        { status: 410 },
      );
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("id", claims.sub)
    .maybeSingle();
  const name =
    profile?.full_name?.trim() || profile?.username?.trim() || "Viewer";

  const token = await mintLivekitToken({
    room: stream.livekit_room,
    identity: claims.sub,
    name,
    canPublish: isHost,
  });
  return NextResponse.json({ url, token, canPublish: isHost });
}
