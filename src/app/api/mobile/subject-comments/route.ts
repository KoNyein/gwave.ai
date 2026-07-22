import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Comments that hang off a knowledge entry (a strain or a mineral) rather than
// a feed post. The native strain/mineral detail screens let users discuss an
// entry with text, a photo, a voice note or a video. Writes go through the
// service role (like /ptt/*) so the device isn't blocked by table RLS.

const AUTHOR = "author:profiles!subject_comments_author_id_fkey(id,username,full_name,avatar_url)";

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

const subjectType = z.enum(["strain", "mineral"]);

const createSchema = z.object({
  subjectType,
  subjectId: z.string().uuid(),
  content: z.string().trim().max(4000).default(""),
  mediaPath: z.string().trim().max(500).nullish(),
  mediaType: z.enum(["image", "audio", "video"]).nullish(),
});

/** GET /api/mobile/subject-comments?type=strain&id=<uuid> — newest last. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = subjectType.safeParse(params.get("type"));
  const id = z.string().uuid().safeParse(params.get("id"));
  if (!type.success || !id.success) {
    return NextResponse.json({ error: "Invalid subject." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subject_comments")
    .select(`id, subject_type, subject_id, author_id, content, media_path, media_type, created_at, ${AUTHOR}`)
    .eq("subject_type", type.data)
    .eq("subject_id", id.data)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ comments: data ?? [] });
}

/** POST /api/mobile/subject-comments — add a comment (optionally with media). */
export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment." }, { status: 400 });
  }
  const input = parsed.data;
  if (!input.content && !input.mediaPath) {
    return NextResponse.json(
      { error: "Write something or attach media." },
      { status: 400 },
    );
  }
  // Media type is required when a media path is present.
  if (input.mediaPath && !input.mediaType) {
    return NextResponse.json({ error: "Missing media type." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subject_comments")
    .insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      author_id: claims.sub,
      content: input.content,
      media_path: input.mediaPath ?? null,
      media_type: input.mediaPath ? input.mediaType : null,
    })
    .select(`id, subject_type, subject_id, author_id, content, media_path, media_type, created_at, ${AUTHOR}`)
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Couldn't post the comment." },
      { status: 500 },
    );
  }
  return NextResponse.json({ comment: data });
}
