import "server-only";

import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "livekit-server-sdk";

/**
 * LiveKit (SFU) configuration. When these are set, co-host Live routes its
 * media through the LiveKit media server instead of the peer-to-peer mesh, so a
 * few publishers can broadcast to thousands of viewers. When unset, co-host
 * Live falls back to the mesh room (good for a handful of co-hosts, no server).
 *
 * - LIVEKIT_API_KEY / LIVEKIT_API_SECRET  server-only, used to mint access tokens
 * - NEXT_PUBLIC_LIVEKIT_URL               wss:// URL the browser connects to
 */
export function livekitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET &&
      process.env.NEXT_PUBLIC_LIVEKIT_URL,
  );
}

export function livekitUrl(): string | null {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL ?? null;
}

/**
 * Mint a signed LiveKit access token for one participant. Publish permission is
 * decided by the caller (host + approved co-hosts publish; everyone else only
 * subscribes) and encoded in the token so a viewer can never publish by
 * tampering with the client.
 */
export async function mintLivekitToken(opts: {
  room: string;
  identity: string;
  name: string;
  canPublish: boolean;
}): Promise<string> {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) {
    throw new Error("LiveKit is not configured (LIVEKIT_API_KEY/SECRET).");
  }

  const at = new AccessToken(key, secret, {
    identity: opts.identity,
    name: opts.name,
    ttl: "2h",
  });
  at.addGrant({
    roomJoin: true,
    room: opts.room,
    canPublish: opts.canPublish,
    canSubscribe: true,
    // Publishers may also share data (reactions, screen share); viewers can
    // send data too (e.g. raise-hand) but not media.
    canPublishData: true,
  });
  return at.toJwt();
}

// ── Auto-save (LiveKit Egress) ──────────────────────────────────────────────
// Records a room composite (the host, any co-hosts, and overlay effects — the
// exact frame viewers see) straight to S3, independent of the host's browser.
// Optional and env-gated like the rest of the media stack: when the egress
// output isn't configured, recording is simply skipped and Live works as before.
//
//   LIVEKIT_EGRESS_S3_BUCKET        bucket the egress worker writes the MP4 to
//   LIVEKIT_EGRESS_S3_ACCESS_KEY    IAM key the egress worker uploads with
//   LIVEKIT_EGRESS_S3_SECRET        …and its secret (egress needs static creds;
//                                    it can't use the app's EC2 instance role)
//   LIVEKIT_EGRESS_S3_REGION        bucket region (default ap-southeast-1)
//   LIVEKIT_EGRESS_S3_PREFIX        key prefix (default "live-recordings")
//   NEXT_PUBLIC_LIVEKIT_EGRESS_BASE public base URL the replay is served from
//                                    (CloudFront/S3 website), used for playback

export function egressConfigured(): boolean {
  return Boolean(
    livekitConfigured() &&
      process.env.LIVEKIT_EGRESS_S3_BUCKET &&
      process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY &&
      process.env.LIVEKIT_EGRESS_S3_SECRET,
  );
}

/** EgressClient talks HTTP(S); NEXT_PUBLIC_LIVEKIT_URL is a wss:// URL. */
function egressHost(): string {
  return (process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "")
    .replace(/^wss:/i, "https:")
    .replace(/^ws:/i, "http:");
}

function egressClient(): EgressClient {
  return new EgressClient(
    egressHost(),
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
  );
}

/**
 * Start recording a room to S3 as MP4. Returns the egress id (to stop later)
 * and the object key the finished file will land at, or null when egress isn't
 * configured. Never throws — a recording failure must not stop the broadcast.
 */
export async function startRoomRecording(
  room: string,
): Promise<{ egressId: string; path: string } | null> {
  if (!egressConfigured()) return null;
  const prefix = (process.env.LIVEKIT_EGRESS_S3_PREFIX || "live-recordings")
    .replace(/^\/+|\/+$/g, "");
  const path = `${prefix}/${room}-${Date.now()}.mp4`;
  try {
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: path,
      disableManifest: true,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey: process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY,
          secret: process.env.LIVEKIT_EGRESS_S3_SECRET,
          bucket: process.env.LIVEKIT_EGRESS_S3_BUCKET,
          region: process.env.LIVEKIT_EGRESS_S3_REGION || "ap-southeast-1",
        }),
      },
    });
    const info = await egressClient().startRoomCompositeEgress(room, output);
    return info.egressId ? { egressId: info.egressId, path } : null;
  } catch {
    return null;
  }
}

/** Stop an in-flight recording. Best-effort — a failure just leaves egress to
 * finish on its own when the room closes. */
export async function stopRoomRecording(egressId: string): Promise<void> {
  if (!livekitConfigured()) return;
  await egressClient()
    .stopEgress(egressId)
    .catch(() => undefined);
}

/** Public URL a saved recording is played back from, or null when its base
 * isn't configured. */
export function recordingPlaybackUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_LIVEKIT_EGRESS_BASE;
  if (!path || !base) return null;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
