import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Reads the authoritative manifest path out of an IVS recording's own metadata,
 * so nothing here has to *guess* the playlist filename.
 *
 * Both IVS products write, next to the media, an events file at
 * `<prefix>/events/recording-ended.json` whose `media.hls` block names the
 * exact playlist that was produced:
 *
 *   {"media":{"hls":{"path":"media/hls","playlist":"multivariant.m3u8", ...}}}
 *
 * (Real-Time composition writes `multivariant.m3u8`; Low-Latency channel
 * recording writes `master.m3u8` — verified for Real-Time by probe, documented
 * for Low-Latency. Reading the events file means we never hardcode either, and
 * an AWS-side rename can't silently turn every replay into a 404. An earlier
 * version guessed `master.m3u8` for Real-Time and stored a path that 404'd.)
 *
 * The events file is written *asynchronously* after a recording finalises, so
 * `readIvsRecordingManifest` retries briefly and returns null if it never
 * appears — a caller that gets null must leave `recording_path` null (the UI
 * shows a "no replay yet" placeholder) rather than store a URL that 404s.
 *
 * The recordings bucket is in IVS_REGION (Tokyo), which is a different region
 * from the app's primary S3 (Singapore) — hence its own client here rather than
 * reusing lib/storage.
 *
 *   IVS_RECORDING_BUCKET   the S3 bucket IVS recordings land in
 *   IVS_REGION             its region (shared with the rest of IVS; Tokyo default)
 */

export function recordingBucket(): string | undefined {
  return process.env.IVS_RECORDING_BUCKET;
}

function recordingS3(): S3Client {
  return new S3Client({ region: process.env.IVS_REGION || "ap-northeast-1" });
}

async function readJson(bucket: string, key: string): Promise<unknown | null> {
  try {
    const res = await recordingS3().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await res.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

interface RecordingEnded {
  media?: { hls?: { path?: string; playlist?: string } };
}

/**
 * Given a recording's S3 key prefix, resolve the object key of its HLS master
 * playlist by reading `<prefix>/events/recording-ended.json`. Retries while the
 * events file is still being written; returns null if it never lands.
 *
 * The returned key is bucket-relative (no leading slash, no host) — exactly what
 * gets stored in `live_streams.recording_path` and later prefixed with the
 * replay CDN base by `ivsRecordingUrl()` (web) / `IVS_RECORDING_BASE` (app).
 */
export async function readIvsRecordingManifest(
  prefix: string,
  { attempts = 6, delayMs = 2500 }: { attempts?: number; delayMs?: number } = {},
): Promise<string | null> {
  const bucket = recordingBucket();
  if (!bucket || !prefix) return null;
  const clean = prefix.replace(/^\/+|\/+$/g, "");
  const eventsKey = `${clean}/events/recording-ended.json`;

  for (let i = 0; i < attempts; i++) {
    const json = (await readJson(bucket, eventsKey)) as RecordingEnded | null;
    const hls = json?.media?.hls;
    if (hls?.path && hls?.playlist) {
      const p = hls.path.replace(/^\/+|\/+$/g, "");
      return `${clean}/${p}/${hls.playlist}`;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}
