import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { latestIvsRecordingPath } from "@/lib/ivs";
import {
  ivsCompositionState,
  resolveIvsCompositionRecording,
  startIvsComposition,
} from "@/lib/ivs-realtime";

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
 * How long a row may claim to be live before we stop believing it.
 *
 * A row leaves `status='live'` when the host ends the broadcast or a webhook
 * fires. Miss both — the browser tab closed, the phone died, the webhook was
 * never wired — and the row says "live" forever. One from a week ago was still
 * sitting at the top of the Live page under a pulsing LIVE badge with a viewer
 * count, playing nothing, on both web and the app.
 *
 * The read paths know to ignore those, but *knowing* is not the same as
 * *fixing*: every surface has to remember, the Flutter app can only be
 * corrected by shipping a new APK, and the row keeps lying to anything new.
 * Correcting the data fixes all of them at once and needs no release.
 *
 * Matches STALE_LIVE_HOURS in lib/db/live.ts.
 */
const STALE_LIVE_HOURS = 12;

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

interface CompositionRow {
  id: string;
  ivs_composition_arn: string | null;
  ivs_recording_prefix?: string | null;
  ivs_stage_arn: string | null;
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

  const endedGhosts = await endStaleLives(admin);
  const revived = await reviveDeadCompositions(admin);
  const composedNow = await startMissingCompositions(admin);
  const compositionReplays = await linkCompositionReplays(admin, since, until);

  return NextResponse.json({
    scanned: rows.length,
    linked,
    stillMissing: still.length,
    endedGhosts,
    revived,
    composedNow,
    compositionReplays,
    lookbackHours: hours,
  });
}

/**
 * Link replays for browser broadcasts.
 *
 * The loop at the top of this route handles channel recordings and skips stage
 * broadcasts on purpose — their recording is written by the composition, at the
 * composition's own S3 prefix, so looking under the channel's would find
 * nothing. That left them with nobody looking again at all: `stopIvsComposition`
 * gets one attempt as the host ends the broadcast, and IVS writes the events
 * file after that, so a recording that finalises a few seconds late was lost
 * for good.
 */
async function linkCompositionReplays(
  admin: ReturnType<typeof createAdminClient>,
  since: string,
  until: string,
): Promise<number> {
  const select = (cols: string) =>
    admin
      .from("live_streams")
      .select(cols)
      .eq("status", "ended")
      .eq("record_enabled", true)
      .is("recording_path", null)
      .not("ivs_composition_arn", "is", null)
      .gte("ended_at", since)
      .lte("ended_at", until)
      .order("ended_at", { ascending: false })
      .limit(MAX_PER_SWEEP)
      .returns<CompositionRow[]>();

  let { data, error } = await select(
    "id, ivs_composition_arn, ivs_recording_prefix, ivs_stage_arn",
  );
  if (error) {
    // ivs_recording_prefix is the newest column here; on a server whose
    // migration has not run (or whose PostgREST has not reloaded), naming it
    // fails the whole select. Ask again without it — the recording can still be
    // found by searching the stage's subtree in S3, which is exactly the path
    // the rows from before that column existed have to take anyway.
    ({ data, error } = await select("id, ivs_composition_arn, ivs_stage_arn"));
  }
  if (error || !data?.length) return 0;

  let linked = 0;
  for (const row of data) {
    const arn = row.ivs_composition_arn;
    if (!arn) continue;
    const path = await resolveIvsCompositionRecording(arn, {
      recordingPrefix: row.ivs_recording_prefix ?? null,
      stageArn: row.ivs_stage_arn,
    });
    if (!path) continue;
    const { error: upErr } = await admin
      .from("live_streams")
      .update({ recording_path: path })
      .is("recording_path", null)
      .eq("id", row.id);
    if (!upErr) linked += 1;
  }
  return linked;
}

/**
 * Put a composition back when the one on the row has died.
 *
 * `StartComposition` returning an ARN is not the same as a composition running.
 * The common failure is starting a second too early: IVS accepts the call,
 * looks at the stage, finds no video being published yet, and gives up within
 * a couple of seconds. The row keeps the ARN of something that no longer
 * exists, so `startMissingCompositions` skips it — the broadcast plays fine and
 * is recorded nowhere, which is exactly the shape of the bug users reported as
 * "live က save မလုပ်ဘူး".
 *
 * So: for anything still live on a stage, ask IVS what its composition is
 * actually doing. `FAILED`, or no record at all, means it is gone — clear the
 * ARN and let the next pass start a fresh one, this time with a host who is
 * definitely publishing.
 *
 * Deliberately does NOT start the replacement here. Clearing the ARN and
 * letting `startMissingCompositions` do it keeps one code path responsible for
 * creating compositions, and costs at most one more minute.
 */
async function reviveDeadCompositions(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const { data, error } = await admin
    .from("live_streams")
    .select("id, ivs_composition_arn")
    .eq("status", "live")
    .not("ivs_stage_arn", "is", null)
    .not("ivs_composition_arn", "is", null)
    .limit(10)
    .returns<{ id: string; ivs_composition_arn: string | null }[]>();
  if (error || !data?.length) return 0;

  let revived = 0;
  for (const row of data) {
    const arn = row.ivs_composition_arn;
    if (!arn) continue;
    const state = await ivsCompositionState(arn);
    // STARTING and ACTIVE are working. STOPPING is on its way out under its own
    // steam and does not want a second composition racing it.
    if (state === "STARTING" || state === "ACTIVE" || state === "STOPPING") {
      continue;
    }
    const { error: upErr } = await admin
      .from("live_streams")
      .update({ ivs_composition_arn: null, ivs_recording_prefix: null })
      .eq("id", row.id)
      // Only while it is still live: if the host ended the broadcast while we
      // were talking to AWS, the ARN is the record of what to look for and must
      // not be thrown away.
      .eq("status", "live")
      .eq("ivs_composition_arn", arn);
    if (upErr) continue;
    revived += 1;
    console.info(
      `[live/sweep] composition ${arn} is ${state ?? "gone"} while the stream ` +
        `is still live — starting a new one for ${row.id}`,
    );
  }
  return revived;
}

/**
 * Start compositions for stages that are live without one.
 *
 * `goLive` starts the composition, but the host component fires that action
 * without awaiting it, so an abort can tear it down between marking the row
 * live and getting the composition going. The broadcast is fine — it is live
 * and, once the composition catches up, watchable off a browser — but until
 * something starts it there is no HLS output and no replay.
 *
 * So: anything live on a stage with no composition gets one, within a minute.
 * A failed start is not retried into a loop — `startIvsComposition` logs the
 * reason and the next tick tries again, which is the right cadence for
 * something that is usually a transient AWS hiccup.
 */
async function startMissingCompositions(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const { data, error } = await admin
    .from("live_streams")
    .select("id, ivs_stage_arn, ivs_channel_arn, record_enabled")
    .eq("status", "live")
    .not("ivs_stage_arn", "is", null)
    .is("ivs_composition_arn", null)
    .limit(5)
    .returns<
      {
        id: string;
        ivs_stage_arn: string | null;
        ivs_channel_arn: string | null;
        record_enabled: boolean;
      }[]
    >();
  if (error || !data?.length) return 0;

  let started = 0;
  for (const row of data) {
    const stage = row.ivs_stage_arn;
    if (!stage) continue;
    const composition = await startIvsComposition(stage, row.ivs_channel_arn, {
      record: row.record_enabled,
    });
    if (!composition) continue;
    const { error: upErr } = await admin
      .from("live_streams")
      .update({ ivs_composition_arn: composition.arn })
      // Only if still missing — goLive may have finished after all, and its
      // composition is the one that should be stopped later.
      .is("ivs_composition_arn", null)
      .eq("id", row.id);
    if (upErr) continue;
    started += 1;
    // Separately, and tolerating failure: the ARN above is what stops this
    // composition and what keeps the next sweep from starting a second one, so
    // it must not be lost to a column that a pending migration has not added
    // yet. The prefix is only worth a replay.
    if (composition.recordingPrefix) {
      await admin
        .from("live_streams")
        .update({ ivs_recording_prefix: composition.recordingPrefix })
        .eq("id", row.id);
    }
  }
  if (started > 0) {
    console.info(`[live/sweep] started ${started} missing composition(s)`);
  }
  return started;
}

/**
 * Mark rows that have claimed to be live for longer than any real broadcast
 * lasts as ended. Returns how many were corrected.
 *
 * `ended_at` is set to the row's own `started_at` rather than now: the
 * broadcast did not end at the moment a cron noticed, and stamping it with the
 * discovery time would invent hours of runtime that never happened.
 */
async function endStaleLives(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - STALE_LIVE_HOURS * 3600_000,
  ).toISOString();
  const { data, error } = await admin
    .from("live_streams")
    .select("id, started_at")
    .eq("status", "live")
    .lt("started_at", cutoff)
    .limit(50)
    .returns<{ id: string; started_at: string | null }[]>();
  if (error || !data?.length) return 0;

  let fixed = 0;
  for (const row of data) {
    const { error: upErr } = await admin
      .from("live_streams")
      .update({ status: "ended", ended_at: row.started_at ?? cutoff })
      .eq("id", row.id)
      .eq("status", "live");
    if (!upErr) fixed += 1;
  }
  if (fixed > 0) {
    console.info(`[live/sweep] ended ${fixed} stale live row(s)`);
  }
  return fixed;
}
