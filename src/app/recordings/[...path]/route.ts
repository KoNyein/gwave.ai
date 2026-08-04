import { NextResponse } from "next/server";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { compositionRecordingBucket } from "@/lib/ivs-realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams saved live recordings (HLS playlists + segments) out of the private
// IVS recordings buckets using the instance role — no CloudFront distribution
// or public bucket needed, and no build-time base URL to configure. The web
// replay player and the app both point here.
//
// Buckets, plural. IVS writes channel recordings to IVS_RECORDING_BUCKET and
// composite (browser-broadcast) recordings to whatever the Real-Time storage
// configuration names, which is a different bucket. The stored path says which
// is which without having to record it: IVS lays channel recordings out under
// `ivs/v1/<account>/<channelId>/...`, while a composite path starts with the
// stage id. Anything not under `ivs/` is therefore a composite.

const s3 = new S3Client({
  region: process.env.IVS_REGION || process.env.AWS_REGION || "ap-southeast-1",
});

// LiveKit egress recordings (metaverse/browser Go Live replays) live in a
// third bucket — LIVEKIT_EGRESS_S3_BUCKET, keyed under the egress prefix
// (default "live-recordings/"). Its region can differ from the IVS one, so
// it gets its own client.
let egressClient: S3Client | null = null;
function egressS3(): S3Client {
  if (!egressClient) {
    egressClient = new S3Client({
      region:
        process.env.LIVEKIT_EGRESS_S3_REGION ||
        process.env.AWS_REGION ||
        "ap-southeast-1",
    });
  }
  return egressClient;
}

function egressPrefix(): string {
  return (process.env.LIVEKIT_EGRESS_S3_PREFIX || "live-recordings").replace(
    /^\/+|\/+$/g,
    "",
  );
}

const TYPES: Record<string, string> = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  mp4: "video/mp4",
  vtt: "text/vtt",
  json: "application/json",
  jpg: "image/jpeg",
  png: "image/png",
};

export async function GET(
  _request: Request,
  props: { params: Promise<{ path: string[] }> },
) {
  const { path } = await props.params;
  const key = (path ?? []).map(decodeURIComponent).join("/");
  if (!key || key.split("/").includes("..")) {
    return NextResponse.json({ error: "Bad path." }, { status: 400 });
  }
  // ★ Bucket resolution by path shape (see header comment) — plus the LiveKit
  // egress prefix: metaverse/browser Go Live replays are MP4s the egress
  // worker wrote to LIVEKIT_EGRESS_S3_BUCKET. Before this branch existed,
  // those keys fell through to the composition bucket and every LiveKit
  // replay 404'd ("Watch the replay" that never plays — user report).
  const isEgress = key.startsWith(`${egressPrefix()}/`);
  const bucket = key.startsWith("ivs/")
    ? process.env.IVS_RECORDING_BUCKET
    : isEgress
      ? process.env.LIVEKIT_EGRESS_S3_BUCKET
      : await compositionRecordingBucket();
  if (!bucket) {
    return NextResponse.json(
      { error: "Recordings are not configured." },
      { status: 503 },
    );
  }
  try {
    const object = await (isEgress ? egressS3() : s3).send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = object.Body?.transformToWebStream();
    if (!body) throw new Error("empty body");
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(body as ReadableStream, {
      headers: {
        "content-type":
          TYPES[ext] ?? object.ContentType ?? "application/octet-stream",
        // Playlists refresh; segments are immutable.
        "cache-control":
          ext === "m3u8" ? "no-cache" : "public, max-age=31536000, immutable",
        ...(object.ContentLength
          ? { "content-length": String(object.ContentLength) }
          : {}),
      },
    });
  } catch {
    // Egress replays have a public CDN in front of their bucket — if the
    // instance role can't read that bucket directly (it predates the LiveKit
    // recording setup), hand the player the CDN URL instead of a 404.
    const cdn = process.env.NEXT_PUBLIC_LIVEKIT_EGRESS_BASE;
    if (isEgress && cdn) {
      return NextResponse.redirect(
        `${cdn.replace(/\/+$/, "")}/${key}`,
        302,
      );
    }
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
