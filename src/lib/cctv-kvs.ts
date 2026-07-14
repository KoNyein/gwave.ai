import "server-only";

import {
  KinesisVideoClient,
  DescribeSignalingChannelCommand,
  GetSignalingChannelEndpointCommand,
} from "@aws-sdk/client-kinesis-video";
import { KinesisVideoSignalingClient } from "@aws-sdk/client-kinesis-video-signaling";
import { GetIceServerConfigCommand } from "@aws-sdk/client-kinesis-video-signaling";
import { STSClient, GetSessionTokenCommand } from "@aws-sdk/client-sts";

// Amazon Kinesis Video Streams (KVS) WebRTC — the server half. A local master
// (KVS WebRTC C SDK + GStreamer, see deploy/kvs-master) pushes the camera's
// RTSP feed into a KVS signaling channel; the browser joins as a viewer. This
// module resolves the channel, its viewer endpoints and ICE servers, and mints
// *short-lived* AWS credentials so the long-lived secret never reaches the
// client. Everything degrades gracefully when KVS is not configured.

const REGION = process.env.KVS_AWS_REGION;
const ACCESS_KEY_ID = process.env.KVS_AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.KVS_AWS_SECRET_ACCESS_KEY;

/** True when the server has AWS credentials + region for KVS. */
export function isKvsConfigured(): boolean {
  return Boolean(REGION && ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

/** Everything the browser viewer SDK needs to join a channel. */
export interface KvsViewerConfig {
  channelARN: string;
  region: string;
  /** Secure WebSocket signaling endpoint (WSS) for the viewer role. */
  wssEndpoint: string;
  iceServers: {
    urls: string | string[];
    username?: string;
    credential?: string;
  }[];
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
  /** A stable per-session viewer client id. */
  clientId: string;
}

function baseCreds() {
  return {
    accessKeyId: ACCESS_KEY_ID as string,
    secretAccessKey: SECRET_ACCESS_KEY as string,
  };
}

/**
 * Resolve a viewer session for a KVS signaling channel: channel ARN, the
 * WSS viewer endpoint, ICE (STUN/TURN) servers, and temporary STS credentials.
 * Returns null when KVS is not configured or the channel can't be resolved.
 */
export async function getKvsViewerConfig(
  channelName: string,
  regionOverride?: string | null,
): Promise<KvsViewerConfig | null> {
  if (!isKvsConfigured() || !channelName) return null;
  const region = (regionOverride || REGION) as string;

  try {
    const kv = new KinesisVideoClient({ region, credentials: baseCreds() });

    // 1) Channel ARN.
    const describe = await kv.send(
      new DescribeSignalingChannelCommand({ ChannelName: channelName }),
    );
    const channelARN = describe.ChannelInfo?.ChannelARN;
    if (!channelARN) return null;

    // 2) Viewer endpoints (WSS for signaling, HTTPS for ICE config).
    const endpoints = await kv.send(
      new GetSignalingChannelEndpointCommand({
        ChannelARN: channelARN,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: ["WSS", "HTTPS"],
          Role: "VIEWER",
        },
      }),
    );
    const wssEndpoint = endpoints.ResourceEndpointList?.find(
      (e) => e.Protocol === "WSS",
    )?.ResourceEndpoint;
    const httpsEndpoint = endpoints.ResourceEndpointList?.find(
      (e) => e.Protocol === "HTTPS",
    )?.ResourceEndpoint;
    if (!wssEndpoint || !httpsEndpoint) return null;

    // 3) ICE servers — always a STUN server, plus KVS TURN relays.
    const iceServers: KvsViewerConfig["iceServers"] = [
      { urls: `stun:stun.kinesisvideo.${region}.amazonaws.com:443` },
    ];
    const signaling = new KinesisVideoSignalingClient({
      region,
      credentials: baseCreds(),
      endpoint: httpsEndpoint,
    });
    const ice = await signaling.send(
      new GetIceServerConfigCommand({ ChannelARN: channelARN }),
    );
    for (const server of ice.IceServerList ?? []) {
      if (!server.Uris) continue;
      iceServers.push({
        urls: server.Uris,
        username: server.Username,
        credential: server.Password,
      });
    }

    // 4) Short-lived credentials for the browser (never the long-lived key).
    const sts = new STSClient({ region, credentials: baseCreds() });
    const session = await sts.send(
      new GetSessionTokenCommand({ DurationSeconds: 3600 }),
    );
    const c = session.Credentials;
    if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) return null;

    return {
      channelARN,
      region,
      wssEndpoint,
      iceServers,
      credentials: {
        accessKeyId: c.AccessKeyId,
        secretAccessKey: c.SecretAccessKey,
        sessionToken: c.SessionToken,
      },
      clientId: `viewer-${Math.random().toString(36).slice(2, 12)}`,
    };
  } catch {
    // Misconfigured channel / region / permissions — treat as unavailable.
    return null;
  }
}
