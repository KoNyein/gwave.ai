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
import { createAdminClient } from "@/lib/data/admin";
import { ensureLiveAnnouncement } from "@/lib/live-announce";
import { notifyFollowersOfLive } from "@/lib/live-notify";
import { after } from "next/server";

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
      ? ", ivs_stage_arn, ivs_channel_arn"
      : "";
  const { data: stream } = await db
    .from("live_streams")
    .select(
      `id, host_id, status, started_at, title, record_enabled, livekit_room, agora_channel${providerCols}`,
    )
    .eq("id", streamId)
    .maybeSingle<{
      id: string;
      host_id: string;
      status: string;
      started_at: string | null;
      title: string | null;
      record_enabled: boolean;
      livekit_room: string | null;
      agora_channel: string | null;
      ivs_stage_arn?: string | null;
      ivs_channel_arn?: string | null;
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
  // Gated by the host's Record choice (international "record → replay" standard).
  // ── Mark it live FIRST, before any provider call ──────────────────────────
  //
  // This update used to come last, after awaiting whichever recording/restream
  // the provider needed. That made the one fact the whole product depends on —
  // "this broadcast is happening" — conditional on an AWS round trip finishing.
  //
  // It doesn't always finish. The host component fires this action and does not
  // await it (`void goLive(id)`), so a re-render or a navigation aborts the
  // request mid-flight, and Next tears the action down where it stands:
  //
  //     ⨯ uncaughtException: [TypeError: Invalid state: Controller is already
  //       closed] { code: 'ERR_INVALID_STATE' }
  //
  // Which is exactly what happened in production. A host published to their
  // stage for nineteen minutes — AWS confirms `published: true` for the whole
  // session — while the row sat at `idle`, so the app and the web listed
  // nothing and every viewer saw an empty page. It had worked the hour before
  // only because the composition ARNs weren't configured yet, so the AWS call
  // returned instantly and the update squeaked in ahead of the abort.
  //
  // Being live is not a side effect of recording. Write it first, on its own,
  // and let everything else be an improvement on top.
  const { error } = await db
    .from("live_streams")
    .update({
      status: "live",
      started_at: stream.started_at ?? new Date().toISOString(),
    })
    .eq("id", stream.id)
    .eq("host_id", user.id);
  if (error) return { ok: false, error: error.message };

  // Announce the broadcast in the news feed: a public post with the live link
  // (clickable + auto-playing live card), so everyone sees the Live without
  // opening the Live tab. Idempotent + service-role + logged — this used to
  // insert through the RLS client and swallow the error object, which left
  // streams live with no feed post and no trace of why.
  const announcementPostId = await ensureLiveAnnouncement({
    hostId: user.id,
    streamId,
    title: stream.title,
  });

  // Notify the host's followers — once per stream. followers_notified_at is a
  // server-owned column locked to the authenticated role (column-lockdown
  // policy), so the atomic claim goes through the service role (BYPASSRLS).
  // Only the first go-live flips it from null; the fan-out runs after the
  // response so a large follower list never slows going live.
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("live_streams")
    .update({ followers_notified_at: new Date().toISOString() })
    .eq("id", streamId)
    .is("followers_notified_at", null)
    .select("id");
  if (claimed && claimed.length > 0) {
    after(() =>
      notifyFollowersOfLive({
        hostId: user.id,
        streamId,
        streamTitle: stream.title,
        announcementPostId,
      }),
    );
  }

  // ── Then the provider work, which may or may not survive ──────────────────
  //
  // Everything above this line is what a person sees: the broadcast is live,
  // it is in the feed, followers have been told. Everything below is an
  // improvement on that — a replay, an HLS restream — and none of it may come
  // between a host going live and the feed knowing about it.
  //
  // Moving the status update up but leaving the announcement down here traded
  // one missing thing for another: the broadcast appeared, and the post that
  // points at it did not, so nobody could find it afterwards. An abort in the
  // AWS call must not be able to swallow a feed post.
  //
  // If this half is cut short the broadcast is still live, still in the feed
  // and still watchable; it just has no replay yet. The sweeper starts
  // compositions for live stages that are missing one, so even a torn-down
  // action heals within a minute.
  const extra: Record<string, string | null> = {};
  // Where the composition is writing the replay. Kept out of `extra` and
  // written separately below — see the write itself for why.
  let recordingPrefix: string | null = null;
  if (stream.ivs_stage_arn) {
    // Deliberately outside the record_enabled gate. For a stage the
    // composition is not only how the replay gets written — it is also how the
    // broadcast reaches an HLS URL, and therefore how anyone not on a browser
    // watches it at all. A host who turns Record off is asking not to be
    // recorded, not to be invisible to every phone in the app. record_enabled
    // decides the S3 destination and nothing else.
    const composition = await startIvsComposition(
      stream.ivs_stage_arn,
      stream.ivs_channel_arn,
      { record: stream.record_enabled },
    );
    if (composition) {
      extra.ivs_composition_arn = composition.arn;
      extra.recording_path = null;
      recordingPrefix = composition.recordingPrefix;
    }
  } else if (!stream.record_enabled) {
    // Host turned Record off — no replay saved.
  } else if (stream.livekit_room && egressConfigured()) {
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
  }

  if (Object.keys(extra).length > 0) {
    const { error: recErr } = await db
      .from("live_streams")
      .update(extra)
      .eq("id", stream.id)
      .eq("host_id", user.id);
    if (recErr) {
      // Not fatal: the broadcast is live either way.
      console.warn("[live/goLive] recording columns not saved:", recErr.message);
    }
  }

  // The recording prefix goes in its own statement, on purpose.
  //
  // It is the newest column here, and a column is only present once the DDL has
  // been applied and PostgREST has reloaded its schema cache — two steps that
  // happen on the server, not in this deploy. Folded into the update above, a
  // deploy that got there first would fail the *whole* statement and lose
  // ivs_composition_arn with it: no ARN means no HLS restream, which means
  // nobody outside a browser can watch the broadcast at all. Losing the replay
  // prefix costs a replay; losing the composition ARN costs the broadcast.
  //
  // So it is written alone, and its failure is logged and survived.
  if (recordingPrefix) {
    const { error: prefixErr } = await db
      .from("live_streams")
      .update({ ivs_recording_prefix: recordingPrefix })
      .eq("id", stream.id)
      .eq("host_id", user.id);
    if (prefixErr) {
      console.warn(
        "[live/goLive] recording prefix not saved — this broadcast's replay " +
          "will have to be found by searching S3:",
        prefixErr.message,
      );
    }
  }

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
