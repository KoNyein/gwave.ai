import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/audio/{trackId}/rating  { stars: 1..5, review?: string }
 * Upserts the viewer's rating (owner-only RLS). One rating per (user, track).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let stars = 0;
  let review: string | undefined;
  try {
    const body = (await req.json()) as { stars?: number; review?: string };
    stars = Math.round(Number(body.stars));
    review = body.review?.slice(0, 2000);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!(stars >= 1 && stars <= 5)) {
    return NextResponse.json({ error: "stars must be 1-5" }, { status: 400 });
  }

  const db = (await createClient()) as unknown as {
    from(t: string): {
      upsert(
        r: Record<string, unknown>,
        opts: { onConflict: string },
      ): PromiseLike<{ error: { message: string } | null }>;
    };
  };
  const { error } = await db
    .from("audio_ratings")
    .upsert(
      { user_id: profile.id, track_id: trackId, stars, review: review ?? null },
      { onConflict: "user_id,track_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
