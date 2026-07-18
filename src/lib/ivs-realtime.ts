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
 * Start a composite recording of the stage to S3. Returns the composition ARN
 * (needed to stop it), or null when recording isn't configured / fails — a
 * recording failure must never block going live.
 */
export async function startIvsComposition(
  stageArn: string,
): Promise<string | null> {
  if (!ivsRtRecordingConfigured()) return null;
  try {
    const res = await rtClient().send(
      new StartCompositionCommand({
        stageArn,
        destinations: [
          {
            s3: {
              storageConfigurationArn: process.env.IVS_RT_STORAGE_CONFIG_ARN!,
              encoderConfigurationArns: [process.env.IVS_RT_ENCODER_CONFIG_ARN!],
            },
          },
        ],
      }),
    );
    return res.composition?.arn ?? null;
  } catch {
    return null;
  }
}

/**
 * Stop a composition and try to resolve where the recording landed. IVS writes
 * HLS under the destination's recording prefix; the master playlist path is
 * stored as the stream's replay when available.
 */
export async function stopIvsComposition(
  compositionArn: string,
): Promise<{ recordingPath: string | null }> {
  const client = rtClient();
  await client
    .send(new StopCompositionCommand({ arn: compositionArn }))
    .catch(() => undefined);
  try {
    const res = await client.send(
      new GetCompositionCommand({ arn: compositionArn }),
    );
    const s3 = res.composition?.destinations?.find((d) => d.detail?.s3)?.detail
      ?.s3 as { recordingPrefix?: string } | undefined;
    return {
      recordingPath: s3?.recordingPrefix
        ? `${s3.recordingPrefix.replace(/\/+$/, "")}/media/hls/master.m3u8`
        : null,
    };
  } catch {
    return { recordingPath: null };
  }
}

/** Public URL a saved IVS recording plays from (CloudFront/S3 over the
 * recordings bucket), or null when unset. */
export function ivsRecordingUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_IVS_RECORDING_BASE;
  if (!path || !base) return null;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
