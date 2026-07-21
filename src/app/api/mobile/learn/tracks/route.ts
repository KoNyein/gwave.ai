import { NextResponse } from "next/server";

import { TRACKS } from "@/lib/learn/lessons";

export const runtime = "nodejs";

/**
 * GET /api/mobile/learn/tracks — the learn catalog for the native app.
 *
 * Lesson content lives in the web bundle (src/lib/learn), so the app can't
 * read it from PostgREST; this serves just the catalog shape — track slugs,
 * titles and lesson lists — so the native Learn screens can render tracks
 * and per-lesson progress ticks. Opening a lesson still goes to the web.
 * Public metadata, cacheable for an hour.
 */
export function GET() {
  const tracks = TRACKS.map((t) => ({
    slug: t.slug,
    title: t.title,
    description: t.description,
    lessons: t.lessons.map((l) => ({
      slug: l.slug,
      title: l.title,
      minutes: l.minutes,
      kind: l.kind,
    })),
  }));
  return NextResponse.json(
    { tracks },
    {
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
