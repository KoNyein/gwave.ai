import "server-only";

import { RtcRole, RtcTokenBuilder } from "agora-token";

/**
 * Agora Video (RTC) is the "best-quality, managed" Live provider for gwave —
 * WebRTC browser publishing, low Asia latency, and Cloud Recording that saves
 * every broadcast straight to S3 with no server for us to run. It sits behind a
 * feature flag alongside the existing LiveKit path: a stream is an Agora stream
 * when its `agora_channel` is set, and LiveKit/Mux stay untouched until cutover.
 *
 * Public (safe in the browser bundle):
 *   NEXT_PUBLIC_AGORA_APP_ID   the App ID the client joins with
 *   NEXT_PUBLIC_LIVE_PROVIDER  "agora" makes NEW streams Agora (default livekit)
 *
 * Server-only (never sent to the client):
 *   AGORA_APP_CERTIFICATE      signs RTC tokens
 *   AGORA_CUSTOMER_ID/SECRET   Cloud Recording REST auth (Basic)
 *   AGORA_RECORDING_S3_*       where Agora uploads the recording (its own creds)
 */

export function agoraConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE,
  );
}

/** New streams use Agora only when both configured and the flag is flipped. */
export function agoraIsDefaultProvider(): boolean {
  return (
    agoraConfigured() && process.env.NEXT_PUBLIC_LIVE_PROVIDER === "agora"
  );
}

export function agoraAppId(): string | null {
  return process.env.NEXT_PUBLIC_AGORA_APP_ID ?? null;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 2; // 2 hours, like the LiveKit tokens

/**
 * Mint an RTC token for one participant. The host publishes (PUBLISHER); viewers
 * subscribe only (SUBSCRIBER) — the role is baked into the signed token so a
 * viewer can never publish by tampering with the client. `uid` must match the
 * numeric uid the client joins with (0 lets Agora assign one, but we pass a
 * stable per-user uid so recording/roster line up).
 */
export function mintAgoraToken(opts: {
  channel: string;
  uid: number;
  role: "host" | "audience";
}): string {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const cert = process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !cert) {
    throw new Error("Agora is not configured (APP_ID/APP_CERTIFICATE).");
  }
  const role = opts.role === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    cert,
    opts.channel,
    opts.uid,
    role,
    TOKEN_TTL_SECONDS,
    TOKEN_TTL_SECONDS,
  );
}

/**
 * Stable non-negative 32-bit uid from a user id (Agora uids are uint32). Two
 * different users effectively never collide; the same user always gets the same
 * uid, so the recording roster and the token agree.
 */
export function agoraUidFor(userId: string): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Keep it in [1, 2^31) — avoid 0 (Agora auto-assign) and the recorder uid.
  return (h >>> 1) || 1;
}

// ── Cloud Recording ─────────────────────────────────────────────────────────
// Agora records the mixed channel in its cloud and uploads the MP4 + HLS to our
// S3 bucket — no recording server for us to run. The flow is acquire → start →
// stop over Agora's REST API; we keep the resourceId+sid to stop it, and read
// the finished file name back from the stop response.

/** A fixed, reserved uid the recorder joins the channel with (hosts derive
 * their uid from a hash and land in a different range). */
const RECORDER_UID = 999_999_999;

export function agoraRecordingConfigured(): boolean {
  return Boolean(
    agoraConfigured() &&
      process.env.AGORA_CUSTOMER_ID &&
      process.env.AGORA_CUSTOMER_SECRET &&
      process.env.AGORA_RECORDING_S3_BUCKET &&
      process.env.AGORA_RECORDING_S3_ACCESS_KEY &&
      process.env.AGORA_RECORDING_S3_SECRET,
  );
}

function recordingAuthHeader(): string {
  const id = process.env.AGORA_CUSTOMER_ID ?? "";
  const secret = process.env.AGORA_CUSTOMER_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

function recordingBaseUrl(): string {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  return `https://api.agora.io/v1/apps/${appId}/cloud_recording`;
}

async function recordingFetch(
  path: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${recordingBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: recordingAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Agora recording ${path} failed: ${res.status}`);
  }
  return json;
}

/** The S3 key prefix (folder) Agora writes a channel's recording under. */
function recordingPrefix(channel: string): string {
  const base = (process.env.AGORA_RECORDING_S3_PREFIX || "live-recordings")
    .replace(/^\/+|\/+$/g, "");
  return `${base}/${channel}`;
}

/**
 * Start recording a channel. Returns the handles needed to stop it plus the S3
 * prefix the files land under, or null when recording isn't configured / fails
 * (a recording failure must never block going live).
 */
export async function startAgoraRecording(
  channel: string,
): Promise<{ resourceId: string; sid: string; prefix: string } | null> {
  if (!agoraRecordingConfigured()) return null;
  try {
    const acquire = await recordingFetch("/acquire", {
      cname: channel,
      uid: String(RECORDER_UID),
      clientRequest: { resourceExpiredHour: 24, scene: 0 },
    });
    const resourceId = acquire["resourceId"] as string | undefined;
    if (!resourceId) return null;

    const prefix = recordingPrefix(channel);
    const token = mintAgoraToken({
      channel,
      uid: RECORDER_UID,
      role: "audience",
    });
    const start = await recordingFetch(
      `/resourceid/${resourceId}/mode/mix/start`,
      {
        cname: channel,
        uid: String(RECORDER_UID),
        clientRequest: {
          token,
          recordingConfig: {
            channelType: 1, // live broadcast
            streamTypes: 2, // audio + video
            subscribeUidGroup: 0,
            maxIdleTime: 30,
            transcodingConfig: {
              width: 720,
              height: 1280,
              fps: 30,
              bitrate: 1500,
              mixedVideoLayout: 1, // best-fit
              backgroundColor: "#000000",
            },
          },
          recordingFileConfig: { avFileType: ["hls", "mp4"] },
          storageConfig: {
            vendor: 1, // AWS S3
            region: Number(process.env.AGORA_RECORDING_S3_REGION ?? "8"), // 8 = ap-southeast-1
            bucket: process.env.AGORA_RECORDING_S3_BUCKET,
            accessKey: process.env.AGORA_RECORDING_S3_ACCESS_KEY,
            secretKey: process.env.AGORA_RECORDING_S3_SECRET,
            fileNamePrefix: prefix.split("/"),
          },
        },
      },
    );
    const sid = start["sid"] as string | undefined;
    if (!sid) return null;
    return { resourceId, sid, prefix };
  } catch {
    return null;
  }
}

/**
 * Stop a recording. Returns the S3 key of the finished MP4 (under the prefix),
 * or null if it can't be determined — the file may still finish uploading, and
 * the DB path can be reconciled later from the prefix.
 */
export async function stopAgoraRecording(
  channel: string,
  resourceId: string,
  sid: string,
): Promise<{ mp4Path: string | null } | null> {
  if (!agoraRecordingConfigured()) return null;
  try {
    const stop = await recordingFetch(
      `/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
      {
        cname: channel,
        uid: String(RECORDER_UID),
        clientRequest: { async_stop: false },
      },
    );
    const server = stop["serverResponse"] as
      | { fileList?: Array<{ fileName?: string; trackType?: string }> }
      | undefined;
    const mp4 = server?.fileList?.find((f) =>
      f.fileName?.toLowerCase().endsWith(".mp4"),
    );
    return { mp4Path: mp4?.fileName ?? null };
  } catch {
    return null;
  }
}
