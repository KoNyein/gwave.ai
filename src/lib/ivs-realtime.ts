import "server-only";

import {
  type Composition,
  CreateParticipantTokenCommand,
  CreateStageCommand,
  DeleteStageCommand,
  GetCompositionCommand,
  GetStorageConfigurationCommand,
  IVSRealTimeClient,
  ParticipantTokenCapability,
  StartCompositionCommand,
  StopCompositionCommand,
} from "@aws-sdk/client-ivs-realtime";

import {
  findRecordingEndedPrefix,
  readIvsRecordingManifest,
  recordingBucket,
} from "@/lib/ivs-recording";

/**
 * Amazon IVS Real-Time — the AWS-native provider for phone-browser Live
 * (FB/TikTok-style). Each broadcast gets an IVS *stage*: the host publishes
 * camera/mic over WebRTC from the browser, viewers subscribe (up to 10,000 per
 * stage), and a server-side *composition* records the mixed view to S3 — no
 * media server of ours anywhere.
 *
 * Region: same constraint as IVS Low-Latency — control plane in IVS_REGION
 * (Tokyo default); media rides AWS's global edge, so viewer latency in Myanmar
 * is unaffected. Credentials come from the EC2 instance role (needs ivs:* on
 * the realtime APIs — see deploy/aws-ivs-setup.md).
 *
 * Env (beyond Phase 1's IVS_REGION):
 *   IVS_RT_STORAGE_CONFIG_ARN   S3 storage configuration for composite recording
 *   IVS_RT_ENCODER_CONFIG_ARN   encoder configuration (720p portrait works well)
 * Both optional — without them, stages work and recording is simply skipped.
 */

function rtClient(): IVSRealTimeClient {
  return new IVSRealTimeClient({
    region: process.env.IVS_REGION || "ap-northeast-1",
  });
}

export function ivsRtRecordingConfigured(): boolean {
  return Boolean(
    process.env.IVS_RT_STORAGE_CONFIG_ARN &&
      process.env.IVS_RT_ENCODER_CONFIG_ARN,
  );
}

/** Create a stage for one broadcast. Returns its ARN. */
export async function createIvsStage(name: string): Promise<string> {
  const res = await rtClient().send(new CreateStageCommand({ name }));
  const arn = res.stage?.arn;
  if (!arn) throw new Error("IVS did not return a usable stage.");
  return arn;
}

/** Delete a stage (cleanup for failed creates / ended streams). Best-effort. */
export async function deleteIvsStage(stageArn: string): Promise<void> {
  await rtClient()
    .send(new DeleteStageCommand({ arn: stageArn }))
    .catch(() => undefined);
}

/**
 * Mint a participant token. The host may publish; viewers subscribe only — the
 * capability set is baked into the signed token, so a viewer can never publish
 * by tampering with the client.
 */
export async function mintIvsStageToken(opts: {
  stageArn: string;
  userId: string;
  name: string;
  canPublish: boolean;
}): Promise<string> {
  const res = await rtClient().send(
    new CreateParticipantTokenCommand({
      stageArn: opts.stageArn,
      userId: opts.userId,
      attributes: { name: opts.name.slice(0, 80) },
      capabilities: opts.canPublish
        ? [ParticipantTokenCapability.PUBLISH, ParticipantTokenCapability.SUBSCRIBE]
        : [ParticipantTokenCapability.SUBSCRIBE],
      duration: 120, // minutes
    }),
  );
  const token = res.participantToken?.token;
  if (!token) throw new Error("IVS did not return a participant token.");
  return token;
}

/**
 * Composite the stage, and send that composite where people can actually watch
 * it. Returns the composition ARN (needed to stop it), or null on failure — a
 * composition failure must never block going live.
 *
 * Two destinations, for two different audiences:
 *
 *  - **channel** — the composite is restreamed into an IVS Low-Latency channel,
 *    which publishes an ordinary HLS URL. This is what makes a browser
 *    broadcast watchable *at all* outside a browser. A stage is a WebRTC SFU:
 *    joining one needs the IVS Real-Time SDK, which the Flutter app does not
 *    have and cannot get. Without this the app could list a live broadcast,
 *    show its LIVE badge and its viewer count, and then render a grey
 *    placeholder where the video should be — which is exactly what it did.
 *  - **s3** — the replay, as before.
 *
 * Each is optional and independent: no channel and it still records; no
 * storage config and it is still watchable. Passing neither is not an error,
 * it just means there is nothing to compose to, so we don't call AWS at all.
 *
 * Returns the composition ARN **and where its recording is going**. The prefix
 * matters: see `IvsComposition.recordingPrefix` below.
 */
export interface IvsComposition {
  /** Needed to stop the composition when the broadcast ends. */
  arn: string;
  /**
   * The S3 prefix the replay is being written to, or null if this composition
   * has no recording destination.
   *
   * **Store this on the row.** It is the only durable record of where the
   * replay lands. The obvious alternative — ask `GetComposition` for it after
   * the broadcast ends — does not work: IVS deletes the composition record
   * shortly after it stops, so by the time anything looks, the ARN 404s:
   *
   *   Resource: arn:aws:ivs:...:composition/tcs3RASP3Asy not found
   *
   * Four broadcasts in a row were recorded correctly and then had no replay
   * because of exactly that. The prefix is handed to us here, while the
   * composition is alive, and it never changes — so write it down now.
   */
  recordingPrefix: string | null;
}

export async function startIvsComposition(
  stageArn: string,
  channelArn?: string | null,
  { record = true }: { record?: boolean } = {},
): Promise<IvsComposition | null> {
  const encoder = process.env.IVS_RT_ENCODER_CONFIG_ARN;
  // The encoder configuration describes the composite frame itself, so it is
  // required by both destinations. Without it there is nothing to compose.
  if (!encoder) {
    console.info(
      "[ivs-rt] Composition skipped: IVS_RT_ENCODER_CONFIG_ARN is not set, " +
        "so browser broadcasts have no HLS output and no replay.",
    );
    return null;
  }

  const destinations = [];
  if (channelArn) {
    destinations.push({
      channel: { channelArn, encoderConfigurationArn: encoder },
    });
  }
  if (record && ivsRtRecordingConfigured()) {
    destinations.push({
      s3: {
        storageConfigurationArn: process.env.IVS_RT_STORAGE_CONFIG_ARN!,
        encoderConfigurationArns: [encoder],
      },
    });
  }
  if (destinations.length === 0) return null;

  try {
    const res = await rtClient().send(
      new StartCompositionCommand({ stageArn, destinations }),
    );
    const arn = res.composition?.arn;
    if (!arn) return null;
    return { arn, recordingPrefix: compositionRecordingPrefix(res.composition) };
  } catch (e) {
    console.warn(
      "[ivs-rt] StartComposition failed — this broadcast will have no HLS " +
        "output and no replay:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * The bucket composite recordings are written to — asked of AWS, not configured.
 *
 * IVS Real-Time writes a composition's recording to whatever bucket its
 * *storage configuration* names, and that is a different bucket from the one
 * Low-Latency channel recordings use. Nothing said so: the manifest reader used
 * `IVS_RECORDING_BUCKET` for both, so every browser broadcast's replay was
 * looked for in the channel bucket, where it had never been. The recordings
 * were sitting in the other bucket the whole time, complete, with their
 * `recording-ended.json` next to them.
 *
 * The obvious fix is a second env var. This asks the storage configuration
 * instead, because the storage configuration *is* the answer: point
 * IVS_RT_STORAGE_CONFIG_ARN somewhere else and the read follows it, with
 * nothing to keep in sync and nothing to get wrong. Answered once and cached —
 * a storage configuration is immutable, so the reply cannot go stale.
 *
 * Falls back to the channel bucket when there is no storage configuration or
 * AWS cannot be reached, which is also the correct answer for a single-bucket
 * setup.
 */
let rtBucket: string | null | undefined;

export async function compositionRecordingBucket(): Promise<string | undefined> {
  const arn = process.env.IVS_RT_STORAGE_CONFIG_ARN;
  if (!arn) return recordingBucket();
  if (rtBucket === undefined) {
    try {
      const res = await rtClient().send(
        new GetStorageConfigurationCommand({ arn }),
      );
      rtBucket = res.storageConfiguration?.s3?.bucketName ?? null;
    } catch (e) {
      // Left null rather than undefined on purpose: one failure should not turn
      // every later read into another AWS round trip.
      rtBucket = null;
      console.warn(
        "[ivs-rt] Could not read the storage configuration's bucket; " +
          "falling back to IVS_RECORDING_BUCKET:",
        e instanceof Error ? e.message : e,
      );
    }
  }
  return rtBucket ?? recordingBucket();
}

/** The S3 prefix a composition is recording to, if it is recording at all. */
function compositionRecordingPrefix(
  composition: Composition | undefined,
): string | null {
  const s3 = composition?.destinations?.find((d) => d.detail?.s3)?.detail?.s3;
  return s3?.recordingPrefix ?? null;
}

/** The stage id out of a stage ARN — the top-level folder its recordings are
 * written under in the bucket. */
function stageIdOf(stageArn: string | null | undefined): string | null {
  const m = stageArn?.match(/:stage\/(.+)$/);
  return m?.[1] ?? null;
}

/** The composition id out of a composition ARN. */
function compositionIdOf(compositionArn: string): string | null {
  const m = compositionArn.match(/:composition\/(.+)$/);
  return m?.[1] ?? null;
}

/**
 * Where a composition's recording is being written.
 *
 * Three sources, in descending order of trust:
 *
 *  1. **The prefix stored on the row** when the composition started. Free,
 *     exact, and always right. Everything below is a fallback for the rows
 *     written before it was stored.
 *  2. **`GetComposition`.** Works only while the composition still exists —
 *     which in practice means while the broadcast is still running.
 *  3. **Looking in the bucket.** Slower, and it can only search the stage's own
 *     subtree, but the recording is still sitting there long after the
 *     composition record that described it has gone.
 */
async function resolveRecordingPrefix(
  compositionArn: string,
  storedPrefix?: string | null,
  stageArn?: string | null,
): Promise<string | null> {
  if (storedPrefix) return storedPrefix;
  try {
    const res = await rtClient().send(
      new GetCompositionCommand({ arn: compositionArn }),
    );
    const prefix = compositionRecordingPrefix(res.composition);
    if (prefix) return prefix;
  } catch (e) {
    // Expected once the composition has been garbage-collected. Not an error —
    // the S3 search below is the answer.
    console.info(
      "[ivs-rt] GetComposition did not answer; searching S3 instead:",
      e instanceof Error ? e.message : e,
    );
  }
  const stageId = stageIdOf(stageArn);
  if (!stageId) return null;
  return await findRecordingEndedPrefix(
    `${stageId}/`,
    compositionIdOf(compositionArn) ?? undefined,
    await compositionRecordingBucket(),
  );
}

/**
 * Stop a composition and resolve where the recording landed.
 *
 * The prefix comes from the row (written down when the composition started);
 * the exact playlist filename comes from the recording's own
 * `events/recording-ended.json`, read by `readIvsRecordingManifest` — we do NOT
 * hardcode the manifest name. (A previous version guessed
 * `<prefix>/media/hls/master.m3u8`; the real file is `multivariant.m3u8`, so
 * every Real-Time replay stored a 404.)
 *
 * The events file is written asynchronously after stop, so the read retries
 * briefly. If it never appears we return null and the caller leaves
 * `recording_path` null — the sweeper looks again later, and a missing replay
 * shows the "no replay yet" placeholder where a wrong one shows a dead player.
 */
export async function stopIvsComposition(
  compositionArn: string,
  opts: { recordingPrefix?: string | null; stageArn?: string | null } = {},
): Promise<{ recordingPath: string | null }> {
  // Resolve *before* stopping. While the composition is still running its
  // record certainly exists, so even a row with nothing stored can still ask
  // AWS; a moment later that chance is gone for good.
  const prefix = await resolveRecordingPrefix(
    compositionArn,
    opts.recordingPrefix,
    opts.stageArn,
  );
  await rtClient()
    .send(new StopCompositionCommand({ arn: compositionArn }))
    // A composition that already stopped on its own is fine and common — the
    // host's broadcast ending takes the stage with it. Anything else means the
    // recording may be incomplete, and an empty catch is not the place to find
    // that out.
    .catch((e: unknown) =>
      console.warn(
        "[ivs-rt] StopComposition failed:",
        e instanceof Error ? e.message : e,
      ),
    );
  if (!prefix) return { recordingPath: null };
  return {
    recordingPath: await readIvsRecordingManifest(prefix, {
      bucket: await compositionRecordingBucket(),
    }),
  };
}

/**
 * Where a composition's recording landed, without stopping anything.
 *
 * `stopIvsComposition` does this too, but it only gets one chance: it runs when
 * the host ends the broadcast, and IVS writes `events/recording-ended.json`
 * asynchronously after that. Miss the window and the row keeps a null
 * `recording_path` — the replay sweeper skips stage broadcasts, because their
 * recording lands at the composition's prefix rather than the channel's.
 *
 * So the sweeper calls this instead. One read attempt only: the cron comes back
 * in a minute, which is a better place to be patient than inside a request.
 */
export async function resolveIvsCompositionRecording(
  compositionArn: string,
  opts: { recordingPrefix?: string | null; stageArn?: string | null } = {},
): Promise<string | null> {
  const prefix = await resolveRecordingPrefix(
    compositionArn,
    opts.recordingPrefix,
    opts.stageArn,
  );
  if (!prefix) return null;
  return await readIvsRecordingManifest(prefix, {
    attempts: 1,
    delayMs: 0,
    bucket: await compositionRecordingBucket(),
  });
}

/** Public URL a saved IVS recording plays from. Defaults to the app's own
 * /recordings proxy (which streams from the private bucket via the instance
 * role), so replays work without a CloudFront distribution or env config. */
export function ivsRecordingUrl(path: string | null): string | null {
  // `||`, not `??`: the Docker image bakes NEXT_PUBLIC_* via `ENV X=$X`, so an
  // unset build ARG arrives as a *defined empty string*. `?? "/recordings"`
  // kept the "", every replay URL lost its /recordings prefix, and the player
  // showed "Source Not Supported" on a 404 HTML page.
  const base = process.env.NEXT_PUBLIC_IVS_RECORDING_BASE || "/recordings";
  if (!path) return null;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
