import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { latestIvsRecordingPath } from "@/lib/ivs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Link the replays that ended too fast to catch.
 *
 * IVS finishes writing a recording to S3 **after** the broadcast stops, and how
 * long that takes scales with the length of the stream. The end routes look the
 * file up the moment the host taps End — so a short broadcast gets its replay
 * and a long one silently doesn't, forever, because nothing ever looks again.
 * In production that came out at four replays from ten broadcasts, every one of
 * which had recording switched on and had really been recorded. The files were
 * in the bucket the whole time; only the row was missing a path.
 *
 * There is meant to be an EventBridge rule calling
 * `/api/live/ivs-recording-webhook` when the recording finalises, which would
 * fix this properly. Whether that rule exists is an AWS-console fact this code
 * can neither check nor rely on, and a replay that depends on one is a replay
 * that goes missing the first time someone edits the wrong rule. So: look
 * again, on a schedule, until the file turns up or a day has passed.
 *
 * Idempotent, and harmless alongside the webhook — a row that already has a
 * path is never selected.
 *
 * Protected by LIVE_SWEEP_SECRET, falling back to RIDE_DISPATCH_SECRET so this
 * needs no new environment variable; both are host-side cron credentials of the
 * same standing. Without either the route refuses to run rather than defaulting
 * to open.
 *
 *   * * * * * curl -sS -X POST https://gwave.cc/api/live/recordings/sweep \
 *       -H "x-dispatch-secret: $SECRET" >/dev/null
 */

/** Don't let one invocation sit in S3 all minute. */
const MAX_PER_SWEEP = 10;

/**
 * Give a recording a moment to exist before asking for it. Below this the end
 * route has usually just looked and failed, and asking again immediately only
 * spends S3 calls to learn the same thing.
 */
const MIN_AGE_S = 90;

/** How far back to look, in hours. A day is long past the point where IVS is
 * still writing; beyond that the file is either there or never coming. */
const DEFAULT_LOOKBACK_H = 24;

/** Ceiling for a one-off catch-up over history (`?hours=720`). */
const MAX_LOOKBACK_H = 720;

interface StuckRow {
  id: string;
  ivs_channel_arn: string | null;
  ended_at: string | null;
}

export async function POST(request: NextRequest) {
  const secret =
    process.env.LIVE_SWEEP_SECRET || process.env.RIDE_DISPATCH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Replay sweeper is not configured." },
      { status: 503 },
    );
  }
  if (request.headers.get("x-dispatch-secret") !== secret) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const hoursParam = Number(request.nextUrl.searchParams.get("hours"));
  const hours =
    Number.isFinite(hoursParam) && hoursParam > 0
      ? Math.min(hoursParam, MAX_LOOKBACK_H)
      : DEFAULT_LOOKBACK_H;

  const now = Date.now();
  const since = new Date(now - hours * 3600_000).toISOString();
  const until = new Date(now - MIN_AGE_S * 1000).toISOString();

  const admin = createAdminClient();

  // Flat query, assembled in code — a resource embed here would 500 on a stale
  // schema cache and take replays down silently.
  const { data, error } = await admin
    .from("live_streams")
    .select("id, ivs_channel_arn, ended_at")
    .eq("status", "ended")
    .eq("record_enabled", true)
    .is("recording_path", null)
    .not("ivs_channel_arn", "is", null)
    // Stage broadcasts also carry a channel now (it is what they are watched
    // on), but their replay is written by the composition to its own S3
    // prefix — nothing lands under the channel's, so looking there would burn
    // an S3 listing per sweep to find nothing. stopIvsComposition resolves
    // those.
    .is("ivs_stage_arn", null)
    .gte("ended_at", since)
    .lte("ended_at", until)
    .order("ended_at", { ascending: false })
    .limit(MAX_PER_SWEEP)
    .returns<StuckRow[]>();
  if (error) {
    console.warn("[live/sweep] select failed", error.message);
    return NextResponse.json({ error: "Could not read streams." }, { status: 500 });
  }

  const rows = data ?? [];
  let linked = 0;
  const still: string[] = [];

  for (const row of rows) {
    const arn = row.ivs_channel_arn;
    if (!arn) continue;
    // Each broadcast gets its own IVS channel, so "the latest recording on this
    // channel" is this broadcast's recording and cannot be somebody else's.
    const path = await latestIvsRecordingPath(arn);
    if (!path) {
      still.push(row.id);
      continue;
    }
    const { error: upErr } = await admin
      .from("live_streams")
      .update({ recording_path: path })
      // Only if it is still missing: the webhook may have won the race while
      // we were talking to S3, and its answer is the more authoritative one.
      .is("recording_path", null)
      .eq("id", row.id);
    if (upErr) {
      console.warn("[live/sweep] update failed", row.id, upErr.message);
      continue;
    }
    linked += 1;
  }

  return NextResponse.json({
    scanned: rows.length,
    linked,
    stillMissing: still.length,
    lookbackHours: hours,
  });
}
