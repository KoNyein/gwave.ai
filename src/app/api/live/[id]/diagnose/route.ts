import { NextResponse } from "next/server";

import { getCurrentProfile, hasRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/live/[id]/diagnose — why this broadcast is missing its feed post,
 * its recording, or its replay.
 *
 * ★ Read-only, and restricted to the stream's host or an admin. It changes
 *   nothing; /api/mobile/live/verify is the one that heals.
 * ★ Why this exists: "the live didn't show up, didn't save and has no replay"
 *   is three separate legs of the pipeline, and from the outside they all look
 *   the same. Each leg is written by a different piece of code and fails for a
 *   different reason — a missing announcement post means the privileged write
 *   failed, a missing recording handle means the provider call failed or
 *   recording was off, a missing recording_path means it never finalised. Told
 *   apart, each has one obvious next step; lumped together they cost an
 *   evening of guessing.
 * ★ It deliberately reports the *provider configuration* too, because the
 *   commonest cause is not a bug in this repo — it is an environment variable
 *   that did not survive a redeploy of /etc/gwave-web.env.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: stream, error: streamErr } = await admin
    .from("live_streams")
    .select(
      "id, host_id, title, status, started_at, ended_at, record_enabled, " +
        "livekit_room, ivs_channel_arn, ivs_stage_arn, ivs_composition_arn, " +
        "ivs_recording_prefix, recording_egress_id, recording_path, " +
        "followers_notified_at",
    )
    .eq("id", id)
    .maybeSingle()
    // ★ The select list is built by concatenation, which defeats the client's
    //   literal-type inference — state the shape instead of losing it.
    .returns<{
      id: string;
      host_id: string;
      title: string | null;
      status: string;
      started_at: string | null;
      ended_at: string | null;
      record_enabled: boolean;
      livekit_room: string | null;
      ivs_channel_arn: string | null;
      ivs_stage_arn: string | null;
      ivs_composition_arn: string | null;
      ivs_recording_prefix: string | null;
      recording_egress_id: string | null;
      recording_path: string | null;
      followers_notified_at: string | null;
    }>();

  // ★ A failure here is itself the answer worth reporting: every privileged
  //   write in the live pipeline goes through this same client, so if the
  //   read fails, all three symptoms follow from one cause.
  if (streamErr) {
    return NextResponse.json(
      {
        error: "The privileged data client failed.",
        detail: streamErr.message,
        meaning:
          "Every server-side live write (feed post, follower claim, recording " +
          "bookkeeping, replay sweep) uses this client. Check /api/health's " +
          "service_role field.",
      },
      { status: 500 },
    );
  }
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }
  if (stream.host_id !== profile.id && !hasRole(profile.role, "admin")) {
    return NextResponse.json({ error: "Host or admin only." }, { status: 403 });
  }

  // ── Leg 1: the feed announcement ────────────────────────────────────────
  const { data: post } = await admin
    .from("posts")
    .select("id, visibility, created_at")
    .eq("author_id", stream.host_id)
    .ilike("content", `%/live/${stream.id}%`)
    .limit(1)
    .maybeSingle();

  // ── Leg 2: was a recording ever started ─────────────────────────────────
  const provider = stream.livekit_room
    ? "livekit"
    : stream.ivs_stage_arn
      ? "ivs-stage"
      : stream.ivs_channel_arn
        ? "ivs-channel"
        : "unknown";

  const recordingHandle =
    stream.recording_egress_id ??
    stream.ivs_composition_arn ??
    stream.ivs_recording_prefix ??
    null;

  return NextResponse.json({
    stream: {
      id: stream.id,
      status: stream.status,
      provider,
      started_at: stream.started_at,
      ended_at: stream.ended_at,
      record_enabled: stream.record_enabled,
    },
    feed_post: post
      ? { ok: true, id: post.id, visibility: post.visibility }
      : {
          ok: false,
          why:
            "No public post links /live/" +
            stream.id +
            ". ensureLiveAnnouncement runs on go-live through the privileged " +
            "client; check the server log for [live/announce] and " +
            "/api/health's service_role field.",
        },
    recording: {
      requested: stream.record_enabled,
      started: recordingHandle !== null,
      handle: recordingHandle,
      why: !stream.record_enabled
        ? "The host turned Record off — nothing is saved by design."
        : recordingHandle
          ? null
          : "Recording was asked for but no handle was written. The provider " +
            "call failed at go-live (LiveKit egress, or the IVS composition/" +
            "recording configuration). Its credentials live in " +
            "/etc/gwave-web.env and are read at runtime.",
    },
    replay: {
      ready: Boolean(stream.recording_path),
      path: stream.recording_path,
      why: stream.recording_path
        ? null
        : stream.status !== "ended"
          ? "The broadcast has not ended — a replay is only finalised after it does."
          : recordingHandle
            ? "Recorded but not finalised. The sweeper (/api/live/recordings/" +
              "sweep) links finished files; check it ran and can read the bucket."
            : "Nothing was recorded, so there is no replay to link.",
    },
    followers_notified_at: stream.followers_notified_at,
  });
}
