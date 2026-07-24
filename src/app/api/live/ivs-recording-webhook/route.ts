import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { readIvsRecordingManifest } from "@/lib/ivs-recording";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * IVS Low-Latency channel recording → `live_streams.recording_path`.
 *
 * This is the piece that makes the SHIPPING mobile app's replays work. Mobile
 * Live goes out over an IVS *Low-Latency channel* (RTMP ingest → HLS), not a
 * Real-Time stage, so it records via a channel RecordingConfiguration, not a
 * composition — a completely separate mechanism. The recording finalises
 * asynchronously well after the host taps "End", so nothing in the request path
 * knows where it landed. Amazon EventBridge does: on "Recording End" it emits an
 * `IVS Recording State Change` event carrying the channel ARN and the exact S3
 * key prefix. An EventBridge rule in ap-northeast-1 forwards that event here (via
 * an API Destination that adds the shared-secret header), and this route writes
 * the replay path onto the row the mobile app reads straight from PostgREST.
 *
 * Without this, mobile broadcasts record to S3 but `recording_path` stays null,
 * so every replay shows the "no replay yet" placeholder forever. (Real-Time
 * stage recordings take a different path — stopIvsComposition resolves those
 * synchronously on end.)
 *
 * Auth: EventBridge can't sign like LiveKit does, so the API Destination's
 * Connection injects a shared secret header. Verified constant-time-ish by
 * length + equality; a mismatch 401s.
 *
 * Setup (ap-northeast-1, the channel/recording region):
 *   - Connection (API key auth, header X-Gwave-IVS-Secret = IVS_RECORDING_WEBHOOK_SECRET)
 *   - API Destination → https://gwave.cc/api/live/ivs-recording-webhook
 *   - Rule: source aws.ivs, detail-type "IVS Recording State Change",
 *           detail.recording_status "Recording End" → the API Destination.
 */

const SECRET_HEADER = "x-gwave-ivs-secret";

interface IvsRecordingEvent {
  resources?: string[];
  detail?: {
    recording_status?: string;
    recording_s3_key_prefix?: string;
    recording_s3_bucket_name?: string;
    channel_arn?: string;
  };
}

export async function POST(request: NextRequest) {
  const expected = process.env.IVS_RECORDING_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Recording webhook is not configured." },
      { status: 503 },
    );
  }
  const provided = request.headers.get(SECRET_HEADER) ?? "";
  if (provided.length !== expected.length || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let event: IvsRecordingEvent;
  try {
    event = (await request.json()) as IvsRecordingEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const detail = event.detail ?? {};
  // Only the terminal event carries a complete recording; ignore Start/Failure.
  if (detail.recording_status !== "Recording End") {
    return NextResponse.json({ ok: true, ignored: detail.recording_status });
  }

  const channelArn = event.resources?.[0] ?? detail.channel_arn;
  const prefix = detail.recording_s3_key_prefix;
  if (!channelArn || !prefix) {
    return NextResponse.json(
      { error: "Missing channel ARN or key prefix." },
      { status: 400 },
    );
  }

  // Authoritative first: the recording's own events file names the playlist.
  // Fallback to Low-Latency's documented master.m3u8 only if that read fails, so
  // a transient S3 hiccup still stores a valid path rather than nothing. The
  // EventBridge prefix is trusted (AWS-signed delivery), so the fallback is not
  // a guess in the way the old Real-Time master.m3u8 guess was.
  const clean = prefix.replace(/^\/+|\/+$/g, "");
  const resolved =
    (await readIvsRecordingManifest(prefix, { attempts: 3, delayMs: 2000 })) ??
    `${clean}/media/hls/master.m3u8`;

  const admin = createAdminClient();
  const { error } = await admin
    .from("live_streams")
    .update({ recording_path: resolved })
    .eq("ivs_channel_arn", channelArn)
    .is("recording_path", null);
  // A swallowed failure here means the replay silently never appears. Return 500
  // so EventBridge retries; the update is idempotent (guarded on null).
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, recording_path: resolved });
}
