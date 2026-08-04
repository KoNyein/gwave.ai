import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

/// 🧬 Scan asset presigned upload (spec §7) — `avatars/{userId}/v{n}/…`
///
/// ★ /api/storage/presign နဲ့ သီးခြား — scan upload က (၁) **consent
///   မရှိရင် ငြင်းရမယ်** (biometric data, spec §10)၊ (၂) key layout က
///   version-folder ပုံစံ (URL immutable — CDN cache-bust က version နဲ့)၊
///   (၃) file type က glb/jpg/png သုံးမျိုးတည်း။
/// ★ Size limit — presigned PUT မှာ hard limit မထည့်လို့ရဘူး၊
///   content-type ပဲ ချုပ်တယ်။ Spec ရဲ့ ≤8MB/≤2MB က client-side စစ်ပြီး
///   S3 lifecycle + room loader ဘက်က ကာကွယ်တယ် (Phase 4 QA)။

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["scan-face.glb", "face-texture.jpg", "thumb.png"]),
});

const CONTENT_TYPES: Record<string, string> = {
  "scan-face.glb": "model/gltf-binary",
  "face-texture.jpg": "image/jpeg",
  "thumb.png": "image/png",
};

const REGION = process.env.AWS_REGION ?? "ap-southeast-1";
const MEDIA_BUCKET = process.env.AWS_S3_MEDIA_BUCKET;

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) client = new S3Client({ region: REGION });
  return client;
}

export async function POST(request: NextRequest) {
  if (!MEDIA_BUCKET) {
    return NextResponse.json({ error: "S3 is not configured." }, { status: 503 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // ★ Biometric consent gate — consent မတိုင်ခင် scan file တင်ခွင့် မရှိဘူး
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("mv_scan_avatars")
    .select("consented_at, version")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!row?.consented_at) {
    return NextResponse.json(
      { error: "Scan မလုပ်ခင် သဘောတူညီချက် အရင်ပေးပါ" },
      { status: 403 },
    );
  }

  // နောက် version folder ထဲ တင်တယ် — သိမ်းတဲ့အခါ version တိုးမှာမို့
  const nextVersion = (Number(row.version) || 1) + 1;
  const key = `avatars/${profile.id}/v${nextVersion}/${parsed.data.kind}`;
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
      ContentType: CONTENT_TYPES[parsed.data.kind],
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 300 },
  );

  return NextResponse.json({ url, path: key });
}

/// Consent ပေး/ဖျက် + "Delete my scan" (spec §10)
export async function DELETE() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const admin = createAdminClient();
  // Hard delete of scan fields — S3 object cleanup က lifecycle rule /
  // version folder overwrite နဲ့ (Phase 4 မှာ object delete ထည့်မယ်)
  const { error } = await admin
    .from("mv_scan_avatars")
    .update({
      face_glb_url: null,
      face_thumb_url: null,
      scan_source: "none",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", profile.id);
  if (error) {
    return NextResponse.json({ error: "ဖျက်လို့ မရပါ" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
