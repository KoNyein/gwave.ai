import { NextResponse } from "next/server";
import { z } from "zod";

import { agoraRecordingConfigured, stopAgoraRecording } from "@/lib/agora";
import { getCurrentProfile } from "@/lib/auth";
import { egressConfigured, stopRoomRecording } from "@/lib/livekit";
import { getMux } from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();

/**
 * POST /api/live/[id]/end — host-only. Signals Mux to finish the broadcast
 * and marks the stream ended immediately (the webhook would eventually do
 * the same, this just makes the UI instant).
 */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!uuid.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid stream id." }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: stream } = await admin
    .from("live_streams")
    .select("id, host_id, mux_stream_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }
  if (stream.host_id !== profile.id) {
    return NextResponse.json({ error: "Host only." }, { status: 403 });
  }
  if (stream.status === "ended") {
    return NextResponse.json({ ok: true });
  }

  // Stop the auto-save recording, if one is running. Per provider, and only
  // when that provider's recording is configured, so a deploy that predates a
  // recording migration never reads the new columns.
  if (egressConfigured()) {
    const { data: rec } = await admin
      .from("live_streams")
      .select("recording_egress_id")
      .eq("id", stream.id)
      .maybeSingle();
    if (rec?.recording_egress_id) {
      // LiveKit egress: the egress_ended webhook stores the finished MP4 path.
      await stopRoomRecording(rec.recording_egress_id);
    }
  } else if (agoraRecordingConfigured()) {
    const { data: rec } = await admin
      .from("live_streams")
      .select("agora_channel, agora_resource_id, agora_recording_sid")
      .eq("id", stream.id)
      .maybeSingle();
    if (rec?.agora_channel && rec.agora_resource_id && rec.agora_recording_sid) {
      const result = await stopAgoraRecording(
        rec.agora_channel,
        rec.agora_resource_id,
        rec.agora_recording_sid,
      );
      // Agora returns the uploaded MP4's key synchronously on stop — store it as
      // the replay right away.
      if (result?.mp4Path) {
        await admin
          .from("live_streams")
          .update({ recording_path: result.mp4Path })
          .eq("id", stream.id);
      }
    }
  }

  try {
    const mux = getMux();
    // complete() ends an in-progress broadcast; disable() stops future ones.
    await mux.video.liveStreams
      .complete(stream.mux_stream_id)
      .catch(() => undefined);
    await mux.video.liveStreams
      .disable(stream.mux_stream_id)
      .catch(() => undefined);
  } catch {
    // Mux not configured — still end it locally so the UI is consistent.
  }

  const { error } = await admin
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", stream.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
