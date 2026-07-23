import { NextResponse } from "next/server";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams saved live recordings (HLS playlists + segments) out of the private
// IVS recordings bucket using the instance role — no CloudFront distribution
// or public bucket needed, and no build-time base URL to configure. The web
// replay player and the app both point here.

const s3 = new S3Client({
  region: process.env.IVS_REGION || process.env.AWS_REGION || "ap-southeast-1",
});

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
  const bucket = process.env.IVS_RECORDING_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { error: "Recordings are not configured." },
      { status: 503 },
    );
  }
  const { path } = await props.params;
  const key = (path ?? []).map(decodeURIComponent).join("/");
  if (!key || key.split("/").includes("..")) {
    return NextResponse.json({ error: "Bad path." }, { status: 400 });
  }
  try {
    const object = await s3.send(
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
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
