import { NextResponse } from "next/server";
import { z } from "zod";

import { agoraIsDefaultProvider } from "@/lib/agora";
import { getCurrentProfile } from "@/lib/auth";
import { createIvsChannel, deleteIvsChannel, ivsIsDefaultProvider } from "@/lib/ivs";
import { createIvsStage, deleteIvsStage } from "@/lib/ivs-realtime";
import { livekitConfigured } from "@/lib/livekit";
import { getMux } from "@/lib/mux";
import { createAdminClient } from "@/lib/data/admin";

/** Short, unguessable-enough LiveKit room name. */
function newLivekitRoom(): string {
  return `live-${crypto.randomUUID().slice(0, 12)}`;
}

/** Short, unguessable-enough Agora channel name (<=64 chars, ascii). */
function newAgoraChannel(): string {
  return `live-${crypto.randomUUID().slice(0, 12)}`;
}

const bodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  // A 'class' is a teacher-hosted live lesson; 'stream' is a normal broadcast.
  kind: z.enum(["stream", "class"]).optional().default("stream"),
  trackSlug: z.string().max(60).optional(),
  scheduledAt: z.string().datetime().optional(),
  // How the host broadcasts (IVS provider only): phone/browser camera, or an
  // RTMP encoder (OBS / game streaming). Other providers ignore it.
  mode: z.enum(["camera", "rtmp"]).optional().default("camera"),
  // Opt-in recording: when true the broadcast is saved and becomes a replay
  // after it ends; when false nothing is recorded (international standard).
  record: z.boolean().optional().default(true),
});

/**
 * POST /api/live/create — provision a Mux live stream for the signed-in
 * user and store it. The stream key is written ONLY to live_stream_keys
 * (host-only RLS); the response echoes it once for immediate display.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  // Only approved teachers (or moderators/admins) may host a live class.
  if (parsed.data.kind === "class") {
    const isStaff = ["moderator", "admin", "super_admin"].includes(
      profile.role,
    );
    if (!profile.is_teacher && !isStaff) {
      return NextResponse.json(
        { error: "Only approved teachers can host a class." },
        { status: 403 },
      );
    }
  }

  // AWS-native path (flagged): Amazon IVS Real-Time. The host broadcasts from
  // the phone/browser camera over WebRTC (FB/TikTok-style); viewers subscribe
  // through AWS's global edge, and a server-side composition records the mixed
  // view to S3. Gated by NEXT_PUBLIC_LIVE_PROVIDER=ivs + mode "camera".
  if (ivsIsDefaultProvider() && parsed.data.mode === "camera") {
    let stageArn: string;
    try {
      stageArn = await createIvsStage(`gwave-${profile.id.slice(0, 8)}`);
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error && /security token|credentials|AccessDenied/i.test(e.message)
              ? "IVS permissions are missing on this server's IAM role. See deploy/aws-ivs-setup.md."
              : "Failed to provision the live stage.",
        },
        { status: 503 },
      );
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("live_streams")
      .insert({
        host_id: profile.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        record_enabled: parsed.data.record,
        ivs_stage_arn: stageArn,
        kind: parsed.data.kind,
        track_slug:
          parsed.data.kind === "class" ? parsed.data.trackSlug || null : null,
        scheduled_at:
          parsed.data.kind === "class"
            ? parsed.data.scheduledAt || null
            : null,
      })
      .select("id")
      .single();
    if (error || !row) {
      await deleteIvsStage(stageArn);
      return NextResponse.json(
        { error: error?.message ?? "Failed to save the stream." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: row.id }, { status: 201 });
  }

  // AWS-native path (flagged): Amazon IVS Low-Latency. Each broadcast gets its
  // own IVS channel — the host pushes RTMPS from OBS (Twitch-style), viewers
  // watch the channel's HLS URL off AWS's global edge, and IVS auto-records to
  // S3 when a recording configuration is attached. Gated by
  // NEXT_PUBLIC_LIVE_PROVIDER=ivs so nothing changes until the flag flips.
  if (ivsIsDefaultProvider()) {
    let channel;
    try {
      channel = await createIvsChannel(
        `gwave-${profile.id.slice(0, 8)}`,
        parsed.data.record,
      );
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error && /security token|credentials|AccessDenied/i.test(e.message)
              ? "IVS permissions are missing on this server's IAM role. See deploy/aws-ivs-setup.md."
              : "Failed to provision the live channel.",
        },
        { status: 503 },
      );
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("live_streams")
      .insert({
        host_id: profile.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        record_enabled: parsed.data.record,
        ivs_channel_arn: channel.channelArn,
        ivs_ingest_url: channel.ingestUrl,
        ivs_playback_url: channel.playbackUrl,
        kind: parsed.data.kind,
        track_slug:
          parsed.data.kind === "class" ? parsed.data.trackSlug || null : null,
        scheduled_at:
          parsed.data.kind === "class"
            ? parsed.data.scheduledAt || null
            : null,
      })
      .select("id")
      .single();
    if (error || !row) {
      // Don't leave an orphaned IVS channel behind.
      await deleteIvsChannel(channel.channelArn);
      return NextResponse.json(
        { error: error?.message ?? "Failed to save the stream." },
        { status: 500 },
      );
    }

    // Stream key is host-only (RLS) — same handling as the Mux key.
    const { error: keyError } = await admin
      .from("live_stream_keys")
      .insert({ stream_id: row.id, stream_key: channel.streamKey });
    if (keyError) {
      await admin.from("live_streams").delete().eq("id", row.id);
      await deleteIvsChannel(channel.channelArn);
      return NextResponse.json({ error: keyError.message }, { status: 500 });
    }

    return NextResponse.json({ id: row.id }, { status: 201 });
  }

  // Best path (flagged): Agora managed WebRTC. A row with agora_channel set is
  // an Agora stream; the host publishes from the browser and Cloud Recording
  // auto-saves to S3. Gated by NEXT_PUBLIC_LIVE_PROVIDER=agora so LiveKit stays
  // the default until cutover.
  if (agoraIsDefaultProvider()) {
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("live_streams")
      .insert({
        host_id: profile.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        record_enabled: parsed.data.record,
        agora_channel: newAgoraChannel(),
        kind: parsed.data.kind,
        track_slug:
          parsed.data.kind === "class" ? parsed.data.trackSlug || null : null,
        scheduled_at:
          parsed.data.kind === "class"
            ? parsed.data.scheduledAt || null
            : null,
      })
      .select("id")
      .single();
    if (error || !row) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save the stream." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: row.id }, { status: 201 });
  }

  // Preferred path: LiveKit SFU. The host broadcasts from the browser
  // (camera/mic) — no Mux, no RTMP key. A row with livekit_room set (and
  // mux_stream_id null) is a LiveKit stream.
  if (livekitConfigured()) {
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("live_streams")
      .insert({
        host_id: profile.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        record_enabled: parsed.data.record,
        livekit_room: newLivekitRoom(),
        kind: parsed.data.kind,
        track_slug:
          parsed.data.kind === "class" ? parsed.data.trackSlug || null : null,
        scheduled_at:
          parsed.data.kind === "class"
            ? parsed.data.scheduledAt || null
            : null,
      })
      .select("id")
      .single();
    if (error || !row) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save the stream." },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: row.id }, { status: 201 });
  }

  // Fallback: Mux (RTMP ingest from OBS).
  let mux;
  try {
    mux = getMux();
  } catch {
    return NextResponse.json(
      { error: "Live streaming is not configured on this server." },
      { status: 503 },
    );
  }

  try {
    const stream = await mux.video.liveStreams.create({
      playback_policy: ["public"],
      new_asset_settings: { playback_policy: ["public"] },
      // Keep the room open across brief encoder drops.
      reconnect_window: 60,
    });

    const playbackId = stream.playback_ids?.[0]?.id ?? null;
    if (!stream.id || !stream.stream_key) {
      return NextResponse.json(
        { error: "Mux did not return a usable stream." },
        { status: 502 },
      );
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("live_streams")
      .insert({
        host_id: profile.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        record_enabled: parsed.data.record,
        mux_stream_id: stream.id,
        mux_playback_id: playbackId,
        kind: parsed.data.kind,
        track_slug:
          parsed.data.kind === "class"
            ? parsed.data.trackSlug || null
            : null,
        scheduled_at:
          parsed.data.kind === "class"
            ? parsed.data.scheduledAt || null
            : null,
      })
      .select("id")
      .single();
    if (error || !row) {
      // Don't leave an orphaned Mux stream behind.
      await mux.video.liveStreams.delete(stream.id).catch(() => undefined);
      return NextResponse.json(
        { error: error?.message ?? "Failed to save the stream." },
        { status: 500 },
      );
    }

    const { error: keyError } = await admin
      .from("live_stream_keys")
      .insert({ stream_id: row.id, stream_key: stream.stream_key });
    if (keyError) {
      await admin.from("live_streams").delete().eq("id", row.id);
      await mux.video.liveStreams.delete(stream.id).catch(() => undefined);
      return NextResponse.json({ error: keyError.message }, { status: 500 });
    }

    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    // Mux rejected the request. A 401/403 means the MUX_TOKEN_ID /
    // MUX_TOKEN_SECRET on this deployment are missing, wrong, or from a
    // different Mux environment — surface a clean, actionable message instead
    // of leaking Mux's raw error JSON to the viewer.
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : undefined;
    if (status === 401 || status === 403) {
      return NextResponse.json(
        {
          error:
            "Live streaming credentials are invalid. Set a valid MUX_TOKEN_ID and MUX_TOKEN_SECRET, then redeploy.",
        },
        { status: 503 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Mux request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
