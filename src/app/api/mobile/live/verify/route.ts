import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import { isIvsChannelLive, latestIvsRecordingPath } from "@/lib/ivs";
import { hostPresentInRoom } from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/live/verify — is this broadcast actually still live?
 * Checks the real media plane (LiveKit room membership or IVS channel state)
 * and self-heals rows whose broadcast died without calling the end API, so
 * dead "live" cards stop appearing and viewers stop opening black screens.
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
    .select(
      "id, host_id, status, livekit_room, ivs_channel_arn, created_at, record_enabled",
    )
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }
  if (stream.status !== "live") {
    return NextResponse.json({ status: stream.status });
  }
  // Brand-new streams get a grace period — the host may still be connecting.
  const ageMs = Date.now() - new Date(stream.created_at as string).getTime();
  if (ageMs < 3 * 60_000) {
    return NextResponse.json({ status: "live" });
  }

  let alive = true;
  if (stream.livekit_room) {
    alive = await hostPresentInRoom(stream.livekit_room, stream.host_id);
  } else if (stream.ivs_channel_arn) {
    alive = await isIvsChannelLive(stream.ivs_channel_arn);
  }
  if (!alive) {
    const recordingPath =
      stream.ivs_channel_arn && stream.record_enabled
        ? await latestIvsRecordingPath(stream.ivs_channel_arn)
        : null;
    await admin
      .from("live_streams")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        ...(recordingPath ? { recording_path: recordingPath } : {}),
      })
      .eq("id", stream.id)
      .eq("status", "live");
    return NextResponse.json({ status: "ended" });
  }
  return NextResponse.json({ status: "live" });
}
