import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * IVS Low-Latency channel went offline → auto-end the `live_streams` row.
 *
 * When a mobile host's broadcast drops (app closed, network lost, crash) the IVS
 * channel stops ingesting and goes offline, but nothing in the request path runs
 * — the host never taps "End" — so the row sits at `status='live'` forever and
 * viewers open a dead "live" that only ever shows "waiting for host". Amazon
 * EventBridge is the only thing that observes the channel going offline: on the
 * ingest session ending it emits an `IVS Stream State Change` event with
 * `event_name: "Stream End"` carrying the channel ARN. A rule in ap-northeast-1
 * forwards that here (via an API Destination that adds the shared-secret header),
 * and this route flips the matching row to `ended` — the auto-end safety net.
 *
 * This is a SIBLING of /api/live/ivs-recording-webhook, not an extension of it:
 * that route lives on an unmerged branch and isn't on `main`/prod (it currently
 * 404s), and its API Destination is URL-bound to the recording path. Recreating
 * it here would clobber concurrent work, so this route reuses the security-
 * sensitive shared infra — the SAME EventBridge Connection (same shared secret,
 * same `IVS_RECORDING_WEBHOOK_SECRET` env) and the SAME IAM role — behind its own
 * API Destination + rule. Auth + idempotency mirror the recording webhook exactly.
 *
 * Auth: EventBridge can't sign like a native webhook, so the API Destination's
 * Connection injects a shared secret header. Verified by length + equality; a
 * mismatch 401s.
 *
 * Only Stream End is acted on. Stream Start / Failure and any non-live row are
 * ignored — this only ever moves a currently-'live' row to 'ended', never
 * resurrects or rewrites an already-ended one.
 */

const SECRET_HEADER = "x-gwave-ivs-secret";

interface IvsStreamEvent {
  resources?: string[];
  detail?: {
    event_name?: string;
    channel_arn?: string;
  };
}

export async function POST(request: NextRequest) {
  const expected = process.env.IVS_RECORDING_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Stream webhook is not configured." },
      { status: 503 },
    );
  }
  const provided = request.headers.get(SECRET_HEADER) ?? "";
  if (provided.length !== expected.length || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let event: IvsStreamEvent;
  try {
    event = (await request.json()) as IvsStreamEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const detail = event.detail ?? {};
  // Only the channel-offline event ends the stream; ignore Start/Failure/etc.
  if (detail.event_name !== "Stream End") {
    return NextResponse.json({ ok: true, ignored: detail.event_name });
  }

  const channelArn = event.resources?.[0] ?? detail.channel_arn;
  if (!channelArn) {
    return NextResponse.json(
      { error: "Missing channel ARN." },
      { status: 400 },
    );
  }

  // Idempotent: only a row that is still 'live' transitions to 'ended'. The
  // `.eq("status", "live")` guard means a redelivery, a stream that already
  // ended cleanly (host tapped End), or an unknown ARN is a harmless no-op —
  // this never resurrects or touches an already-ended row.
  const admin = createAdminClient();
  const { error } = await admin
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("ivs_channel_arn", channelArn)
    .eq("status", "live");
  // A swallowed failure here means the stream stays stuck "live". Return 500 so
  // EventBridge retries; the update is idempotent (guarded on status='live').
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, channel_arn: channelArn });
}
