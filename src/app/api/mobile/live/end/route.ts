import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { latestIvsRecordingPath, stopIvsStream } from "@/lib/ivs";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/live/end — host ends the native broadcast. Stops the IVS
 * channel (recording, when configured, finalizes to S3 on its own) and marks
 * the stream ended immediately so the Live tab updates without waiting.
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
    .select("id, host_id, status, ivs_channel_arn, record_enabled")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }
  if (stream.host_id !== claims.sub) {
    return NextResponse.json({ error: "Host only." }, { status: 403 });
  }
  if (stream.status === "ended") return NextResponse.json({ ok: true });

  let recordingPath: string | null = null;
  if (stream.ivs_channel_arn) {
    await stopIvsStream(stream.ivs_channel_arn).catch(() => undefined);
    // Link the replay only when the host opted in to recording — otherwise no
    // recording exists (the channel was created without a recording config).
    if (stream.record_enabled) {
      recordingPath = await latestIvsRecordingPath(stream.ivs_channel_arn);
    }
  }

  const { error } = await admin
    .from("live_streams")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      ...(recordingPath ? { recording_path: recordingPath } : {}),
    })
    .eq("id", stream.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
