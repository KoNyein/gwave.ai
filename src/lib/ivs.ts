import "server-only";

import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

import {
  CreateChannelCommand,
  DeleteChannelCommand,
  GetStreamCommand,
  IvsClient,
  StopStreamCommand,
} from "@aws-sdk/client-ivs";

/**
 * Amazon IVS Low-Latency Streaming — the AWS-native Live provider for
 * OBS/game-style broadcasts (the exact stack Twitch runs on). Each gwave stream
 * gets its own IVS channel: the host pushes RTMPS from OBS with a per-channel
 * stream key, viewers watch the channel's HLS playback URL (global edge, ~3s
 * latency), and IVS auto-records to S3 when a recording configuration is
 * attached — no media server of ours anywhere.
 *
 * Region note: IVS control plane isn't offered in ap-southeast-1, so channels
 * are created in IVS_REGION (default ap-northeast-1, Tokyo). Video ingest and
 * playback ride AWS's global edge network regardless, so viewer latency in
 * Myanmar is unaffected; only the API calls and the recording bucket live in
 * Tokyo.
 *
 * Credentials come from the EC2 instance role (default provider chain) — the
 * role needs ivs:CreateChannel/StopStream/DeleteChannel (see
 * deploy/aws-ivs-setup.md). Env:
 *   IVS_REGION                    control-plane region (default ap-northeast-1)
 *   IVS_RECORDING_CONFIG_ARN      optional; attach to channels for S3 auto-record
 *   NEXT_PUBLIC_LIVE_PROVIDER=ivs New broadcasts use IVS (flag; default livekit)
 */

export function ivsConfigured(): boolean {
  // The SDK signs with the instance role; the only hard requirement is the
  // flag-independent region (which has a default), so IVS is considered
  // available unless explicitly disabled.
  return process.env.IVS_DISABLED !== "1";
}

/** New streams use IVS only when the provider flag says so. */
export function ivsIsDefaultProvider(): boolean {
  return ivsConfigured() && process.env.NEXT_PUBLIC_LIVE_PROVIDER === "ivs";
}

function ivsClient(): IvsClient {
  return new IvsClient({
    region: process.env.IVS_REGION || "ap-northeast-1",
  });
}

export interface IvsChannel {
  channelArn: string;
  /** RTMPS URL the host pastes into OBS (includes the /app/ path). */
  ingestUrl: string;
  /** Secret stream key — store host-only, never on the public row. */
  streamKey: string;
  /** HLS playback URL viewers watch. */
  playbackUrl: string;
}

/**
 * Create an IVS channel for one broadcast. LOW latency + BASIC type covers
 * 480p→1080p adaptive; the recording configuration is attached only when the
 * host opted in (`record`), so IVS writes the HLS/MP4 replay to S3 on stream
 * end for opt-in broadcasts and skips recording entirely otherwise — the
 * international-standard "record → replay" behaviour.
 */
export async function createIvsChannel(
  name: string,
  record = false,
): Promise<IvsChannel> {
  const recordingArn = record ? process.env.IVS_RECORDING_CONFIG_ARN : undefined;
  const res = await ivsClient().send(
    new CreateChannelCommand({
      name,
      latencyMode: "LOW",
      type: "STANDARD",
      ...(recordingArn ? { recordingConfigurationArn: recordingArn } : {}),
    }),
  );
  const arn = res.channel?.arn;
  const ingest = res.channel?.ingestEndpoint;
  const playback = res.channel?.playbackUrl;
  const key = res.streamKey?.value;
  if (!arn || !ingest || !playback || !key) {
    throw new Error("IVS did not return a usable channel.");
  }
  return {
    channelArn: arn,
    ingestUrl: `rtmps://${ingest}:443/app/`,
    streamKey: key,
    playbackUrl: playback,
  };
}

/**
 * The S3 key of the newest recording IVS wrote for a channel, or null. IVS
 * lays recordings out as ivs/v1/<account>/<channelId>/<y>/<m>/<d>/<H>/<M>/
 * <recordingId>/media/hls/master.m3u8 (zero-padded, so lexicographic order is
 * chronological). Nothing stores this key when a plain channel stops — no
 * EventBridge webhook is wired — so the end/verify routes derive it here.
 */
export async function latestIvsRecordingPath(
  channelArn: string,
): Promise<string | null> {
  const bucket = process.env.IVS_RECORDING_BUCKET;
  const m = channelArn.match(/^arn:aws:ivs:[^:]+:(\d+):channel\/(.+)$/);
  if (!bucket || !m) return null;
  try {
    const s3 = new S3Client({
      region:
        process.env.IVS_REGION || process.env.AWS_REGION || "ap-southeast-1",
    });
    const prefix = `ivs/v1/${m[1]}/${m[2]}/`;
    let token: string | undefined;
    let latest: string | null = null;
    do {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of res.Contents ?? []) {
        const key = obj.Key ?? "";
        if (key.endsWith("/media/hls/master.m3u8") && (!latest || key > latest)) {
          latest = key;
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return latest;
  } catch {
    return null;
  }
}

/**
 * Is the channel broadcasting right now? IVS has no webhook wired into the app
 * yet (that needs EventBridge), so the watch page checks the channel state when
 * an idle IVS stream is opened and flips it live — OBS starts pushing, the next
 * page view marks it live for everyone.
 */
export async function isIvsChannelLive(channelArn: string): Promise<boolean> {
  try {
    const res = await ivsClient().send(new GetStreamCommand({ channelArn }));
    return res.stream?.state === "LIVE";
  } catch {
    // ChannelNotBroadcasting (or any API error) — treat as not live.
    return false;
  }
}

/** Stop an in-progress broadcast on a channel. Best-effort — the host closing
 * OBS ends it anyway; this just makes "End stream" instant. */
export async function stopIvsStream(channelArn: string): Promise<void> {
  await ivsClient()
    .send(new StopStreamCommand({ channelArn }))
    .catch(() => undefined);
}

/** Delete a channel (cleanup for failed creates). Best-effort. */
export async function deleteIvsChannel(channelArn: string): Promise<void> {
  await ivsClient()
    .send(new DeleteChannelCommand({ arn: channelArn }))
    .catch(() => undefined);
}
