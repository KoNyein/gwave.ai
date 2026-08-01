import "server-only";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

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

/** How many 1000-key pages a search will read before giving up. The bucket also
 * holds every channel recording ever made, so an unbounded scan would grow
 * without limit; a stage's own subtree is a handful of keys. */
const MAX_SEARCH_PAGES = 5;

/**
 * Find a recording's prefix in S3 when nobody wrote it down.
 *
 * This is the recovery path, not the normal one. A composition's prefix is
 * known the moment it starts and is stored on the row; this exists for the
 * broadcasts that ended before it was, and for the case where the stored value
 * is somehow missing. It looks for the recording's own
 * `events/recording-ended.json` under `searchPrefix` and returns the prefix
 * that contains it.
 *
 * `contains` (the composition id) picks the right one when a stage somehow has
 * several recordings. When nothing matches it, the newest is returned instead:
 * a stage belongs to exactly one broadcast, so anything recorded under it is
 * that broadcast's.
 */
export async function findRecordingEndedPrefix(
  searchPrefix: string,
  contains?: string,
): Promise<string | null> {
  const bucket = recordingBucket();
  if (!bucket || !searchPrefix) return null;
  const suffix = "/events/recording-ended.json";
  try {
    const s3 = recordingS3();
    let token: string | undefined;
    let newest: string | null = null;
    let matched: string | null = null;
    for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: searchPrefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of res.Contents ?? []) {
        const key = obj.Key ?? "";
        if (!key.endsWith(suffix)) continue;
        const prefix = key.slice(0, -suffix.length);
        if (contains && prefix.includes(contains)) matched = prefix;
        if (!newest || prefix > newest) newest = prefix;
      }
      if (matched) return matched;
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
      if (!token) break;
    }
    return matched ?? newest;
  } catch {
    return null;
  }
}
