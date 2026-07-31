import "server-only";

import {
  CreateParticipantTokenCommand,
  CreateStageCommand,
  DeleteStageCommand,
  GetCompositionCommand,
  IVSRealTimeClient,
  ParticipantTokenCapability,
  StartCompositionCommand,
  StopCompositionCommand,
} from "@aws-sdk/client-ivs-realtime";

import { readIvsRecordingManifest } from "@/lib/ivs-recording";

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
 */
export async function startIvsComposition(
  stageArn: string,
  channelArn?: string | null,
  { record = true }: { record?: boolean } = {},
): Promise<string | null> {
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
    return res.composition?.arn ?? null;
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
 * Stop a composition and resolve where the recording landed.
 *
 * The composition detail gives us the S3 *prefix*; the exact playlist filename
 * comes from the recording's own `events/recording-ended.json`, read by
 * `readIvsRecordingManifest` — we do NOT hardcode the manifest name. (A previous
 * version guessed `<prefix>/media/hls/master.m3u8`; the real file is
 * `multivariant.m3u8`, so every Real-Time replay stored a 404.)
 *
 * The events file is written asynchronously after stop, so the resolve retries
 * briefly. If it never appears we return null and the caller leaves
 * `recording_path` null — a missing replay shows the "no replay yet"
 * placeholder; a wrong one shows a dead player.
 */
export async function stopIvsComposition(
  compositionArn: string,
): Promise<{ recordingPath: string | null }> {
  const client = rtClient();
  await client
    .send(new StopCompositionCommand({ arn: compositionArn }))
    .catch(() => undefined);
  try {
    // Read the prefix before the composition record is garbage-collected.
    const res = await client.send(
      new GetCompositionCommand({ arn: compositionArn }),
    );
    const s3 = res.composition?.destinations?.find((d) => d.detail?.s3)?.detail
      ?.s3 as { recordingPrefix?: string } | undefined;
    if (!s3?.recordingPrefix) return { recordingPath: null };
    return {
      recordingPath: await readIvsRecordingManifest(s3.recordingPrefix),
    };
  } catch {
    return { recordingPath: null };
  }
}

/**
 * Where a composition's recording landed, without stopping anything.
 *
 * `stopIvsComposition` does this too, but it only gets one chance: it runs
 * when the host ends the broadcast, and IVS writes
 * `events/recording-ended.json` asynchronously after that. Miss the window and
 * the row keeps a null `recording_path` with nothing left to look again — the
 * replay sweeper skips stage broadcasts, because their recording lands at the
 * composition's prefix rather than the channel's.
 *
 * So the sweeper calls this instead. One retry pass only: the cron comes back
 * in a minute, which is a better place to be patient than inside a request.
 */
export async function resolveIvsCompositionRecording(
  compositionArn: string,
): Promise<string | null> {
  try {
    const res = await rtClient().send(
      new GetCompositionCommand({ arn: compositionArn }),
    );
    const s3 = res.composition?.destinations?.find((d) => d.detail?.s3)?.detail
      ?.s3 as { recordingPrefix?: string } | undefined;
    if (!s3?.recordingPrefix) return null;
    return await readIvsRecordingManifest(s3.recordingPrefix, {
      attempts: 1,
      delayMs: 0,
    });
  } catch (e) {
    console.warn(
      "[ivs-rt] Could not resolve a composition recording:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
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
