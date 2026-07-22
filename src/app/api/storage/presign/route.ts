import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";

/**
 * Hands the browser a short-lived, single-object S3 PUT URL so it can upload
 * straight to S3 — the same shape the legacy object storage's client upload had,
 * minus that backend. The object key is always `<caller uid>/<uuid>.<ext>`, mirroring the
 * old bucket layout so existing DB paths keep resolving after the switch.
 *
 * Credentials come from the EC2 instance role (default provider chain) — no
 * static keys in the app. Only reachable when AWS_S3_MEDIA_BUCKET is set, so the
 * whole S3 path stays dormant until cutover.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  bucket: z.enum(["media", "slips", "chat-media"]).default("media"),
  ext: z
    .string()
    .regex(/^[a-z0-9]{1,10}$/i, "bad extension")
    .default("bin"),
  contentType: z.string().max(120).default("application/octet-stream"),
});

const REGION = process.env.AWS_REGION ?? "ap-southeast-1";
const MEDIA_BUCKET = process.env.AWS_S3_MEDIA_BUCKET;
const SLIPS_BUCKET = process.env.AWS_S3_SLIPS_BUCKET;
const CHAT_BUCKET = process.env.AWS_S3_CHAT_BUCKET;

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) client = new S3Client({ region: REGION });
  return client;
}

export async function POST(request: NextRequest) {
  if (!MEDIA_BUCKET) {
    return NextResponse.json({ error: "S3 is not configured." }, { status: 503 });
  }

  // The key is namespaced by the caller's own id, so a user can only ever write
  // into their own folder — the same guarantee the legacy storage RLS gave.
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const bucket =
    parsed.data.bucket === "slips"
      ? SLIPS_BUCKET
      : parsed.data.bucket === "chat-media"
        ? CHAT_BUCKET
        : MEDIA_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: "Bucket not configured." }, { status: 503 });
  }

  const key = `${profile.id}/${randomUUID()}.${parsed.data.ext.toLowerCase()}`;
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: parsed.data.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 120 },
  );

  return NextResponse.json({ url, path: key });
}
