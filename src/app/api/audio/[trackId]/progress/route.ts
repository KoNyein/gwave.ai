import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/audio/{trackId}/progress
 * Saves the exact playback position so the user can resume on any device.
 * One row per (user, track), upserted — last write wins. Body is throttled by
 * the client (every ~10 s + on pause/seek/close).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: {
    position_s?: number;
    duration_s?: number;
    chapter_idx?: number;
    speed?: number;
    completed?: boolean;
    device?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const row = {
    user_id: profile.id,
    track_id: trackId,
    position_s: Math.max(0, Math.round(body.position_s ?? 0)),
    duration_s: body.duration_s != null ? Math.round(body.duration_s) : null,
    chapter_idx: body.chapter_idx ?? null,
    speed: body.speed ?? 1.0,
    completed: body.completed === true,
    device: (body.device ?? "web").slice(0, 40),
    updated_at: new Date().toISOString(),
  };

  const db = (await createClient()) as unknown as {
    from(t: string): {
      upsert(
        r: Record<string, unknown>,
        opts: { onConflict: string },
      ): PromiseLike<{ error: { message: string } | null }>;
    };
  };
  const { error } = await db
    .from("audio_progress")
    .upsert(row, { onConflict: "user_id,track_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
