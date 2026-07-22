"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

import type { ActionResult } from "@/lib/actions/posts";
import {
  agoraAppId,
  agoraConfigured,
  agoraRecordingConfigured,
  agoraUidFor,
  mintAgoraToken,
  startAgoraRecording,
} from "@/lib/agora";
import {
  mintIvsStageToken,
  startIvsComposition,
} from "@/lib/ivs-realtime";
import {
  egressConfigured,
  livekitConfigured,
  livekitUrl,
  mintLivekitToken,
  startRoomRecording,
} from "@/lib/livekit";
import { createClient } from "@/lib/data/server";

export interface LiveStageToken {
  url: string;
  token: string;
  canPublish: boolean;
}

/**
 * Mint a LiveKit token for a single-broadcaster Live stream. The host gets a
 * publish token (camera/mic/screen); everyone else subscribes only — so one
 * broadcaster reaches thousands of viewers through the SFU.
 */
export async function getLiveStageToken(
  streamId: string,
): Promise<ActionResult<LiveStageToken>> {
  if (!livekitConfigured()) return { ok: false, error: "SFU not configured" };
  const url = livekitUrl();
  if (!url) return { ok: false, error: "SFU not configured" };

  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: stream } = await db
    .from("live_streams")
    .select("id, host_id, status, livekit_room")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream) return { ok: false, error: "Stream not found" };
  if (!stream.livekit_room) {
    return { ok: false, error: "This stream is not a LiveKit stream." };
  }
  if (stream.status === "ended") {
    return { ok: false, error: "This broadcast has ended." };
  }

  const isHost = stream.host_id === user.id;

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .maybeSingle();
  const name =
    profile?.full_name?.trim() || profile?.username?.trim() || "Guest";

  const token = await mintLivekitToken({
    room: stream.livekit_room,
    identity: user.id,
    name,
    canPublish: isHost,
  });
  return { ok: true, data: { url, token, canPublish: isHost } };
}

export interface AgoraStageToken {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  canPublish: boolean;
}

/**
 * Mint an Agora RTC token for a single-broadcaster stream. The host publishes
 * (camera/mic); everyone else subscribes only — the role is baked into the
 * signed token so a viewer can't publish by tampering with the client. `uid` is
 * derived deterministically from the user id so the token and roster agree.
 */
export async function getAgoraStageToken(
  streamId: string,
): Promise<ActionResult<AgoraStageToken>> {
  if (!agoraConfigured()) return { ok: false, error: "Live provider not configured" };
  const appId = agoraAppId();
  if (!appId) return { ok: false, error: "Live provider not configured" };

  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: stream } = await db
    .from("live_streams")
    .select("id, host_id, status, agora_channel")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream) return { ok: false, error: "Stream not found" };
  if (!stream.agora_channel) {
    return { ok: false, error: "This stream is not an Agora stream." };
  }
  if (stream.status === "ended") {
    return { ok: false, error: "This broadcast has ended." };
  }

  const isHost = stream.host_id === user.id;
  const uid = agoraUidFor(user.id);
  const token = mintAgoraToken({
    channel: stream.agora_channel,
    uid,
    role: isHost ? "host" : "audience",
  });
  return {
    ok: true,
    data: { appId, channel: stream.agora_channel, token, uid, canPublish: isHost },
  };
}

/**
 * Mint an IVS Real-Time participant token for a stage stream. The host may
 * publish (capability baked into the signed token); everyone else subscribes.
 */
export async function getIvsStageToken(
  streamId: string,
): Promise<ActionResult<{ token: string; canPublish: boolean }>> {
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: stream } = await db
    .from("live_streams")
    .select("id, host_id, status, ivs_stage_arn")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream) return { ok: false, error: "Stream not found" };
  if (!stream.ivs_stage_arn) {
    return { ok: false, error: "This stream is not an IVS stage." };
  }
  if (stream.status === "ended") {
    return { ok: false, error: "This broadcast has ended." };
  }

  const isHost = stream.host_id === user.id;
  const { data: profile } = await db
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .maybeSingle();
  const name =
    profile?.full_name?.trim() || profile?.username?.trim() || "Guest";

  try {
    const token = await mintIvsStageToken({
      stageArn: stream.ivs_stage_arn,
      userId: user.id,
      name,
      canPublish: isHost,
    });
    return { ok: true, data: { token, canPublish: isHost } };
  } catch {
    return { ok: false, error: "Live provider is not reachable." };
  }
}

/**
 * Host: flip a LiveKit stream to "live" once the browser starts publishing.
 * Idempotent — safe to call again on reconnect.
 */
export async function goLive(streamId: string): Promise<ActionResult> {
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const providerCols =
    process.env.NEXT_PUBLIC_LIVE_PROVIDER === "ivs"
      ? ", ivs_stage_arn"
      : "";
  const { data: stream } = await db
    .from("live_streams")
    .select(
      `id, host_id, status, started_at, title, livekit_room, agora_channel${providerCols}`,
    )
    .eq("id", streamId)
    .maybeSingle<{
      id: string;
      host_id: string;
      status: string;
      started_at: string | null;
      title: string | null;
      livekit_room: string | null;
      agora_channel: string | null;
      ivs_stage_arn?: string | null;
    }>();
  if (!stream) return { ok: false, error: "Stream not found" };
  if (stream.host_id !== user.id) return { ok: false, error: "Host only" };
  if (stream.status === "ended") {
    return { ok: false, error: "This broadcast has ended." };
  }
  if (stream.status === "live") return { ok: true, data: undefined };

  // Auto-save: start recording to S3 on this one live-transition (the status
  // guard above makes goLive idempotent, so this runs once). Per provider, and
  // only when that provider's recording is configured — a failure returns null
  // and the broadcast proceeds without a recording. The recording columns are
  // only read/written when the relevant provider is configured, so a deploy that
  // predates a recording migration leaves go-live untouched.
  const extra: Record<string, string | null> = {};
  if (stream.livekit_room && egressConfigured()) {
    const rec = await startRoomRecording(stream.livekit_room);
    if (rec) {
      extra.recording_egress_id = rec.egressId;
      extra.recording_path = null;
    }
  } else if (stream.agora_channel && agoraRecordingConfigured()) {
    const rec = await startAgoraRecording(stream.agora_channel);
    if (rec) {
      extra.agora_resource_id = rec.resourceId;
      extra.agora_recording_sid = rec.sid;
      extra.recording_path = null;
    }
  } else if (stream.ivs_stage_arn) {
    const arn = await startIvsComposition(stream.ivs_stage_arn);
    if (arn) {
      extra.ivs_composition_arn = arn;
      extra.recording_path = null;
    }
  }

  const { error } = await db
    .from("live_streams")
    .update({
      status: "live",
      started_at: stream.started_at ?? new Date().toISOString(),
      ...extra,
    })
    .eq("id", stream.id)
    .eq("host_id", user.id);
  if (error) return { ok: false, error: error.message };

  // Announce the broadcast in the news feed: a public post with the live link
  // (clickable + preview card), so followers see the Live without opening the
  // Live tab. Runs once per stream (the status guard above) and best-effort —
  // a feed hiccup must not block going live.
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://gwave.cc";
  await db
    .from("posts")
    .insert({
      author_id: user.id,
      content: `🔴 Live လွှင့်နေပါပြီ — ${stream.title ?? "Live"}\n${site}/live/${streamId}`,
      visibility: "public",
    })
    .then(
      () => undefined,
      () => undefined,
    );

  revalidatePath(`/live/${streamId}`);
  return { ok: true, data: undefined };
}

/**
 * Host, on "End + save": drop a wrap-up post into the feed with the replay
 * link, an optional 📍 location (stored as the post's check-in too) and
 * optional friend tags (free-text names/usernames rendered as @mentions).
 */
export async function saveLiveWrapPost(
  streamId: string,
  location: string,
  friends: string,
): Promise<ActionResult> {
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: stream } = await db
    .from("live_streams")
    .select("id, host_id, title")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream) return { ok: false, error: "Stream not found" };
  if (stream.host_id !== user.id) return { ok: false, error: "Host only" };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://gwave.cc";
  const loc = location.trim().slice(0, 120);
  const tagged = friends
    .split(/[,\s]+/)
    .map((f) => f.trim().replace(/^@/, ""))
    .filter(Boolean)
    .slice(0, 10)
    .map((f) => `@${f}`)
    .join(" ");

  const lines = [
    `📼 Live ပြီးပါပြီ — ${stream.title ?? "Live"}`,
    `${site}/live/${streamId}`,
  ];
  if (loc) lines.push(`📍 ${loc}`);
  if (tagged) lines.push(`👥 ${tagged}`);

  const { error } = await db.from("posts").insert({
    author_id: user.id,
    content: lines.join("\n"),
    visibility: "public",
    location_name: loc || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Host sets the game tag + support goal for a game live stream. */
export async function setStreamGameGoal(
  streamId: string,
  input: { gameName?: string; goalAmount?: number; goalLabel?: string },
): Promise<ActionResult> {
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const gameName = (input.gameName ?? "").trim().slice(0, 60);
  const goalLabel = (input.goalLabel ?? "").trim().slice(0, 80);
  const goalAmount =
    input.goalAmount != null && input.goalAmount > 0
      ? Math.round(input.goalAmount)
      : null;

  const { error } = await db
    .from("live_streams")
    .update({
      game_name: gameName || null,
      goal_amount: goalAmount,
      goal_label: goalLabel || null,
    })
    .eq("id", streamId)
    .eq("host_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/live/${streamId}`);
  return { ok: true, data: undefined };
}
