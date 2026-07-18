import { NextRequest, NextResponse } from "next/server";
import { EgressStatus, WebhookReceiver } from "livekit-server-sdk";

import { egressConfigured, stopRoomRecording } from "@/lib/livekit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * LiveKit webhook — the only thing that ends a broadcast when the host doesn't.
 *
 * Without it, a stream is marked `ended` only when the host taps "End stream".
 * A host who closes the tab, loses signal, or whose battery dies leaves a row
 * stuck at `status='live'` forever: it sits at the top of /live under a pulsing
 * red LIVE badge, and every viewer who clicks it lands in an empty room. (The
 * Mux webhook can't cover this — it matches on `mux_stream_id`, which is NULL
 * on every LiveKit row.)
 *
 * Two events close a room:
 *   participant_left — the *host* dropped. Nobody is publishing any more, so
 *                      the broadcast is over even though viewers may still be
 *                      connected keeping the room alive.
 *   room_finished   — the room emptied out and LiveKit tore it down.
 *
 * LiveKit signs each delivery with the API secret; WebhookReceiver.receive()
 * rejects anything unsigned or tampered with, so this route needs no session.
 *
 * Configure the sender in /etc/livekit/livekit.yaml on the SFU:
 *   webhook:
 *     api_key: APIgwave
 *     urls:
 *       - https://gwave.cc/api/live/livekit-webhook
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) {
    return NextResponse.json({ error: "LiveKit is not configured." }, { status: 503 });
  }

  const body = await request.text();
  const auth = request.headers.get("Authorization") ?? "";

  let event;
  try {
    const receiver = new WebhookReceiver(key, secret);
    event = await receiver.receive(body, auth);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // Auto-save: when a recording finishes, egress reports the uploaded MP4's
  // object key — store it as the stream's replay. Matched on egress id (egress
  // events don't always carry the room).
  if (event.event === "egress_ended" || event.event === "egress_updated") {
    const eg = event.egressInfo;
    const filename = eg?.fileResults?.[0]?.filename;
    if (
      eg?.egressId &&
      filename &&
      eg.status === EgressStatus.EGRESS_COMPLETE
    ) {
      const admin = createAdminClient();
      await admin
        .from("live_streams")
        .update({ recording_path: filename })
        .eq("recording_egress_id", eg.egressId);
    }
    return NextResponse.json({ ok: true });
  }

  const room = event.room?.name;
  if (!room) return NextResponse.json({ ok: true });

  const hostLeft =
    event.event === "participant_left" && Boolean(event.participant?.identity);
  const roomFinished = event.event === "room_finished";
  if (!hostLeft && !roomFinished) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Co-host rooms are named `cohost-<code>`; single-broadcaster rooms `live-<id>`.
  if (room.startsWith("cohost-")) {
    const code = room.slice("cohost-".length);
    const { data: cohost } = await admin
      .from("cohost_rooms")
      .select("id, host_id, ended_at")
      .eq("code", code)
      .maybeSingle();
    if (!cohost || cohost.ended_at) return NextResponse.json({ ok: true });

    // A co-host room outlives any one guest leaving — only the host dropping,
    // or the room emptying, ends it.
    if (hostLeft && event.participant?.identity !== cohost.host_id) {
      return NextResponse.json({ ok: true });
    }
    // A PostgREST error is a returned value, not a throw. If this end-the-room
    // update fails and we still return 200, LiveKit won't retry and the co-host
    // room is stuck live forever (a pulsing LIVE badge over an empty room — the
    // exact bug this route exists to prevent). Return 500 so LiveKit retries;
    // the update is idempotent.
    const { error } = await admin
      .from("cohost_rooms")
      .update({ ended_at: now })
      .eq("id", cohost.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ended: "cohost", code });
  }

  const { data: stream } = await admin
    .from("live_streams")
    .select("id, host_id, status")
    .eq("livekit_room", room)
    .maybeSingle();
  if (!stream || stream.status === "ended") return NextResponse.json({ ok: true });

  if (hostLeft && event.participant?.identity !== stream.host_id) {
    return NextResponse.json({ ok: true });
  }

  // The broadcast is over (host dropped or room torn down) — stop the auto-save
  // recording so the MP4 is finalised promptly rather than when the room later
  // times out. Only touched when egress is configured, so a deploy that predates
  // the recording migration never reads the new column.
  if (egressConfigured()) {
    const { data: rec } = await admin
      .from("live_streams")
      .select("recording_egress_id")
      .eq("id", stream.id)
      .maybeSingle();
    if (rec?.recording_egress_id) {
      await stopRoomRecording(rec.recording_egress_id);
    }
  }

  const { error } = await admin
    .from("live_streams")
    .update({ status: "ended", ended_at: now })
    .eq("id", stream.id);
  // Same as above: a swallowed failure here leaves the stream stuck "live".
  // Return 500 so LiveKit retries; the update is idempotent.
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ended: "stream", id: stream.id });
}
