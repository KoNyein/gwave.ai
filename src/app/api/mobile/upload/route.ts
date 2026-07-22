import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/upload — the native app's presigned S3 upload.
 *
 * The JSON twin of the web `/api/storage/presign`, which authenticates from the
 * `gw_at` cookie. Native apps can't share that cookie, so this authenticates
 * from the `Authorization: Bearer <data token>` header instead (same token the
 * app already sends to PostgREST). It returns a short-lived S3 PUT URL; the app
 * uploads the bytes straight to S3, then stores the returned `path`. The key is
 * always `<caller uid>/<uuid>.<ext>`, matching the web's layout so a stored path
 * resolves under CloudFront the same way for both clients.
 *
 * Only reachable when AWS_S3_MEDIA_BUCKET is set (S3 is the active backend); on
 * the legacy object storage the app uploads directly and never calls this.
 */
const REGION = process.env.AWS_REGION ?? "ap-southeast-1";
const MEDIA_BUCKET = process.env.AWS_S3_MEDIA_BUCKET;
const CHAT_BUCKET = process.env.AWS_S3_CHAT_BUCKET;

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) client = new S3Client({ region: REGION });
  return client;
}

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

const bodySchema = z.object({
  bucket: z.enum(["media", "chat-media"]).default("media"),
  ext: z
    .string()
    .regex(/^[a-z0-9]{1,10}$/i, "bad extension")
    .default("bin"),
  contentType: z.string().max(120).default("application/octet-stream"),
});

export async function POST(request: NextRequest) {
  if (!MEDIA_BUCKET) {
    return NextResponse.json({ error: "S3 is not configured." }, { status: 503 });
  }

  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const bucket =
    parsed.data.bucket === "chat-media" ? CHAT_BUCKET ?? MEDIA_BUCKET : MEDIA_BUCKET;

  // Namespaced by the caller's own id — a user can only ever write into their
  // own folder, the same guarantee the storage RLS gave.
  const key = `${claims.sub}/${randomUUID()}.${parsed.data.ext.toLowerCase()}`;
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
