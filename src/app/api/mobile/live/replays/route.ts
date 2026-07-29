import { NextRequest, NextResponse } from "next/server";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import { liveReplayUrl } from "@/lib/live-replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/live/replays — the native app's Live tab.
 *
 * Returns what's broadcasting right now, then past broadcasts, each with its
 * replay URL already resolved. The app deliberately gets a finished `replayUrl`
 * rather than a storage path: building the URL a second time in Dart is how the
 * reels player ended up pointing at a dead backend after the S3 cutover.
 *
 * `replayUrl` is null for a broadcast with no saved recording — the app shows
 * "no replay" rather than a dead player.
 *
 * Read-only and public content, but bearer-authed like its siblings under
 * /api/mobile/live so guest builds don't quietly depend on an open endpoint.
 */

/** Same staleness rule as the web /live index (lib/db/live.ts). A row stuck at
 * status='live' because a webhook was missed must not sit under a LIVE badge
 * forever, so anything "live" for longer than this is listed as past. */
const STALE_LIVE_HOURS = 12;

const SELECT =
  "id, title, description, status, started_at, ended_at, created_at, viewer_count, " +
  "recording_path, livekit_room, agora_channel, ivs_stage_arn, ivs_channel_arn, " +
  "ivs_playback_url, " +
  "host:profiles!live_streams_host_id_fkey(id, username, full_name, avatar_url)";

interface Row {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  viewer_count: number | null;
  recording_path: string | null;
  livekit_room: string | null;
  agora_channel: string | null;
  ivs_stage_arn: string | null;
  ivs_channel_arn: string | null;
  ivs_playback_url: string | null;
  host: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

function shape(row: Row) {
  const replayUrl = liveReplayUrl(row);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    viewerCount: row.viewer_count ?? 0,
    host: row.host
      ? {
          id: row.host.id,
          username: row.host.username,
          fullName: row.host.full_name,
          avatarUrl: row.host.avatar_url,
        }
      : null,
    replayUrl,
    /** HLS needs a different player than a progressive MP4 on some devices. */
    replayIsHls: replayUrl ? replayUrl.includes(".m3u8") : false,
    /** Watch-live URL, when this stream is one the app can play directly. */
    playbackUrl: row.status === "live" ? row.ivs_playback_url : null,
    /** Deep link into the web player — covers WebRTC streams the app can't join. */
    webUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://gwave.cc"}/live/${row.id}`,
  };
}

export async function GET(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 50)
      : 30;
  const hostId = url.searchParams.get("hostId") ?? undefined;

  const staleCutoff = new Date(
    Date.now() - STALE_LIVE_HOURS * 60 * 60 * 1000,
  ).toISOString();

  // service_role read: live_streams rows are public content and the columns
  // returned here carry no secrets (the RTMP key lives in live_stream_keys,
  // which is never touched). Using the admin client keeps this one query off
  // the per-request RLS path for a list the whole app hits on every open.
  const admin = createAdminClient();

  let liveQuery = admin
    .from("live_streams")
    .select(SELECT)
    .eq("status", "live")
    .gte("started_at", staleCutoff)
    .order("started_at", { ascending: false })
    .limit(limit);
  let pastQuery = admin
    .from("live_streams")
    .select(SELECT)
    .or(`status.neq.live,started_at.lt.${staleCutoff}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (hostId) {
    liveQuery = liveQuery.eq("host_id", hostId);
    pastQuery = pastQuery.eq("host_id", hostId);
  }

  const [liveRes, pastRes] = await Promise.all([
    liveQuery.returns<Row[]>(),
    pastQuery.returns<Row[]>(),
  ]);
  // A silent failure here would render as "nobody has ever gone live", which is
  // indistinguishable from an empty database — surface it instead.
  if (liveRes.error || pastRes.error) {
    return NextResponse.json(
      { error: (liveRes.error ?? pastRes.error)?.message ?? "Query failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    live: (liveRes.data ?? []).map(shape),
    past: (pastRes.data ?? []).map(shape),
  });
}
