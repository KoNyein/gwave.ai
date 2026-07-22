import { NextResponse } from "next/server";

import { getMux } from "@/lib/mux";
import { createAdminClient } from "@/lib/data/admin";

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

  const isLiveEvent = event.type.startsWith("video.live_stream.");
  const isAssetEvent = event.type.startsWith("video.asset.");
  if (!isLiveEvent && !isAssetEvent) {
    return NextResponse.json({ received: true });
  }

  const data = event.data as {
    id?: string;
    playback_ids?: { id: string }[];
    live_stream_id?: string;
  };

  const admin = createAdminClient();

  // Auto-saved recording: Mux records every broadcast (new_asset_settings) into
  // an asset carrying the parent live_stream_id. When that asset is ready,
  // store its playback id so ended streams become watchable replays.
  if (isAssetEvent) {
    if (
      (event.type === "video.asset.ready" ||
        event.type === "video.asset.live_stream_completed") &&
      data.live_stream_id &&
      data.playback_ids?.[0]?.id
    ) {
      const { error } = await admin
        .from("live_streams")
        .update({ vod_playback_id: data.playback_ids[0].id })
        .eq("mux_stream_id", data.live_stream_id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  const muxStreamId = data.id;
  if (!muxStreamId) {
    return NextResponse.json({ received: true });
  }

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
