import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import { notifyFollowersOfLive } from "@/lib/live-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/live/start — the app's encoder connected; flip the stream
 * to `live` and drop the announcement post into the feed (the same behavior
 * as the web goLive action, minus the WebRTC stage bits the RTMP path
 * doesn't have).
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

  const admin = createAdminClient();
  const { data: stream } = await admin
    .from("live_streams")
    .select("id, host_id, title, status, started_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }
  if (stream.host_id !== claims.sub) {
    return NextResponse.json({ error: "Host only." }, { status: 403 });
  }
  if (stream.status === "live") return NextResponse.json({ ok: true });

  const { error } = await admin
    .from("live_streams")
    .update({
      status: "live",
      started_at: stream.started_at ?? new Date().toISOString(),
    })
    .eq("id", stream.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Feed announcement, once and best-effort — a hiccup must not block going live.
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://gwave.cc";
  let announcementPostId: string | null = null;
  try {
    const { data: post } = await admin
      .from("posts")
      .insert({
        author_id: claims.sub,
        content: `🔴 Live — ${stream.title ?? "Live"}\n${site}/live/${stream.id}`,
        visibility: "public",
      })
      .select("id")
      .maybeSingle();
    announcementPostId = (post?.id as string | null) ?? null;
  } catch {
    /* best-effort: a feed hiccup must not block going live. */
  }

  // Notify the host's followers — exactly once per stream. Claim the marker
  // atomically (only the first idle->live transition flips it from null), so a
  // reconnect that calls /start again never re-notifies. The fan-out runs after
  // the response is sent so a large follower list never slows going live.
  const { data: claimed } = await admin
    .from("live_streams")
    .update({ followers_notified_at: new Date().toISOString() })
    .eq("id", stream.id)
    .is("followers_notified_at", null)
    .select("id");
  if (claimed && claimed.length > 0) {
    after(() =>
      notifyFollowersOfLive({
        hostId: claims.sub,
        streamId: stream.id,
        streamTitle: stream.title,
        announcementPostId,
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
