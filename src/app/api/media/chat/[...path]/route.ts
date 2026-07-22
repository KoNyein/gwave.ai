import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { CHAT_BUCKET, mediaUrl } from "@/lib/media";
import { createClient } from "@/lib/data/server";

/**
 * Serves one chat attachment out of the private "chat-media" bucket.
 *
 * Chat photos, files and voice notes used to sit in the public "media" bucket:
 * anyone with the URL could read them, signed in or not. They now live in a
 * private bucket, and this route is the only way back in — it checks that the
 * caller is a participant in the conversation the attachment was sent to, then
 * redirects to a short-lived signed URL.
 *
 * Why a redirect rather than streaming the bytes through here: <img>, <video>,
 * <audio> and <a download> cannot send an Authorization header, and the signed
 * URL keeps Range requests working (audio scrubbing, video seeking) without this
 * route proxying hundreds of megabytes. The tradeoff is that the signed URL is
 * visible to page scripts via the Resource Timing API, which is why the
 * lifetimes below are short.
 */
export const dynamic = "force-dynamic";

/** <userId>/<uuid>.<ext> — the only key shape putObject ever writes. */
const PATH_PATTERN =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i;

/**
 * How long a signature lives, and how long the browser may reuse the redirect.
 * The redirect must always expire first, or a cached 302 would outlive the
 * signature it points at and start serving broken images.
 */
const DEFAULT_LIFETIME = { sign: 300, cache: 60 };
const LIFETIMES: Record<string, { sign: number; cache: number }> = {
  image: DEFAULT_LIFETIME,
  file: DEFAULT_LIFETIME,
  audio: { sign: 900, cache: 120 },
  video: { sign: 3600, cache: 300 },
};

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  // The dormant S3 backend has no equivalent of this route yet. Fail loudly
  // rather than quietly handing back a public URL and undoing the whole point.
  if (process.env.NEXT_PUBLIC_S3_CDN) {
    return NextResponse.json(
      { error: "Chat media on S3 is not configured." },
      { status: 500 },
    );
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const path = params.path.join("/");
  if (!PATH_PATTERN.test(path)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const db = await createClient();

  // Authorization happens here, explicitly, before we try to sign. Doing it the
  // other way round — sign, and treat a failure as "not allowed" — would make a
  // missing object and a forbidden object indistinguishable.
  const { data: meta } = await db
    .rpc("chat_object_meta", { p_path: path })
    .maybeSingle<{ kind: string; file_name: string | null }>();

  // Not a participant, or no such attachment. Same answer for both: saying
  // "403" here would confirm that the object exists.
  if (!meta) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const lifetime = LIFETIMES[meta.kind] ?? DEFAULT_LIFETIME;
  const download = request.nextUrl.searchParams.has("dl");

  const { data: signed, error } = await db.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, lifetime.sign, {
      // The filename comes from the row we just authorized, never from the query
      // string — a client-supplied one is a Content-Disposition injection.
      download: download ? (meta.file_name ?? true) : false,
    });

  if (error || !signed?.signedUrl) {
    // Objects uploaded before the private bucket existed are still in the public
    // one. This keeps them loading while the backfill runs, and is removed with
    // CHAT_MEDIA_FALLBACK_PUBLIC once it has. Authorization already passed above,
    // so this is not a hole — but leaving the flag on after the backfill would
    // silently downgrade any genuine signing failure to a public URL.
    if (process.env.CHAT_MEDIA_FALLBACK_PUBLIC === "1") {
      return NextResponse.redirect(mediaUrl(path), {
        status: 302,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: {
      // Never "public": the signed URL is specific to this viewer.
      "Cache-Control": `private, max-age=${lifetime.cache}`,
      Vary: "Cookie",
    },
  });
}
