import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";

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
    await admin.from("cohost_rooms").update({ ended_at: now }).eq("id", cohost.id);
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

  await admin
    .from("live_streams")
    .update({ status: "ended", ended_at: now })
    .eq("id", stream.id);
  return NextResponse.json({ ok: true, ended: "stream", id: stream.id });
}
