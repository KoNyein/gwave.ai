import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getCognitoSessionUser } from "@/lib/cognito-session";
import { getServiceRoleKey, isCognitoEnabled, publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Hard ceiling; individual callers enforce their own tighter limits client-side. */
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const EXT_ALLOW = /^[a-z0-9]{1,12}$/;
/** Buckets the browser may upload into through this route. */
const BUCKET_ALLOW = new Set(["media", "slips"]);

/**
 * Server-side upload into the "media" storage bucket.
 *
 * Storage still lives on the Supabase Cloud project (Caddy proxies /sb/* there),
 * which validates JWTs with a secret we don't hold — so under Cognito the browser
 * can't sign a token Cloud storage will accept, and a direct upload fails with
 * "signature verification failed". Instead the browser POSTs the (already
 * compressed) bytes here, and we upload with the Cloud service-role key, which
 * Cloud accepts. The object path is derived from the *session* user, never the
 * client, so a caller can only ever write into their own folder.
 *
 * Body: raw file bytes. `?ext=` sets the extension; Content-Type sets the stored
 * type. Returns { storage_path }.
 */
export async function POST(req: Request) {
  if (!isCognitoEnabled()) {
    // On Supabase Auth the browser uploads directly; this route isn't used.
    return NextResponse.json({ error: "Not supported." }, { status: 400 });
  }
  const user = await getCognitoSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const ext = (params.get("ext") ?? "bin").toLowerCase();
  if (!EXT_ALLOW.test(ext)) {
    return NextResponse.json({ error: "Bad file type." }, { status: 400 });
  }
  const bucket = params.get("bucket") ?? "media";
  if (!BUCKET_ALLOW.has(bucket)) {
    return NextResponse.json({ error: "Bad bucket." }, { status: 400 });
  }
  const contentType =
    req.headers.get("content-type") || "application/octet-stream";

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "Empty file." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large." }, { status: 413 });
  }

  const path = `${user.id}/${randomUUID()}.${ext}`;
  // Raw service key (not a minted token): Cloud storage accepts the opaque
  // sb_secret_ key, and it bypasses storage RLS.
  const storage = createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServiceRoleKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await storage.storage
    .from(bucket)
    .upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ storage_path: path });
}
