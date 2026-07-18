import { NextResponse } from "next/server";

import { getMux } from "@/lib/mux";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/live/webhook — Mux event sink. The signature is verified with
 * MUX_WEBHOOK_SECRET before anything is trusted; requests that fail
 * verification are rejected.
 *
 *   video.live_stream.active   → status 'live'   (+ started_at, playback id)
 *   video.live_stream.idle     → status 'ended'  (+ ended_at) once it was live
 *   video.live_stream.disabled → status 'ended'
 */
export async function POST(request: Request) {
  if (!process.env.MUX_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 503 },
    );
  }

  const body = await request.text();

  let event;
  try {
    // unwrap() verifies the mux-signature header against the raw body.
    event = await getMux().webhooks.unwrap(body, request.headers);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!event.type.startsWith("video.live_stream.")) {
    return NextResponse.json({ received: true });
  }

  const data = event.data as {
    id?: string;
    playback_ids?: { id: string }[];
  };
  const muxStreamId = data.id;
  if (!muxStreamId) {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();

  try {
    // A PostgREST error is a returned value, not a throw, so these updates must
    // check `error` and throw — otherwise a failed status flip falls through to
    // `{ received: true }` / HTTP 200, Mux never retries, and the broadcast is
    // stuck in the wrong state (never goes live, or stuck "live" with viewers in
    // an empty room). Throwing routes to the catch below → 500 → Mux retries.
    // The updates are idempotent, so a retry is safe.
    if (event.type === "video.live_stream.active") {
      const { error } = await admin
        .from("live_streams")
        .update({
          status: "live",
          started_at: new Date().toISOString(),
          ended_at: null,
          ...(data.playback_ids?.[0]?.id
            ? { mux_playback_id: data.playback_ids[0].id }
            : {}),
        })
        .eq("mux_stream_id", muxStreamId);
      if (error) throw new Error(error.message);
    } else if (
      event.type === "video.live_stream.idle" ||
      event.type === "video.live_stream.disabled"
    ) {
      // Only a stream that actually went live transitions to 'ended';
      // an idle event before the first broadcast keeps it joinable.
      const { error } = await admin
        .from("live_streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("mux_stream_id", muxStreamId)
        .eq("status", "live");
      if (error) throw new Error(error.message);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
