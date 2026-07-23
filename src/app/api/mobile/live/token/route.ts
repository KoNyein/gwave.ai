import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import { livekitConfigured, livekitUrl, mintLivekitToken } from "@/lib/livekit";

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
    .select("id, host_id, status, livekit_room")
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

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("id", claims.sub)
    .maybeSingle();
  const name =
    profile?.full_name?.trim() || profile?.username?.trim() || "Viewer";

  const isHost = stream.host_id === claims.sub;
  const token = await mintLivekitToken({
    room: stream.livekit_room,
    identity: claims.sub,
    name,
    canPublish: isHost,
  });
  return NextResponse.json({ url, token, canPublish: isHost });
}
