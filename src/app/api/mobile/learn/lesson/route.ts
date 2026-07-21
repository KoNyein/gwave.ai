import { NextRequest, NextResponse } from "next/server";

import { localizeLesson } from "@/lib/learn/i18n";
import { getLesson } from "@/lib/learn/lessons";

export const runtime = "nodejs";

/**
 * GET /api/mobile/learn/lesson?track=<slug>&lesson=<slug>&lang=<en|my>
 *
 * Full lesson content for the native lesson reader. Lesson content lives in
 * the web bundle (src/lib/learn), not the database, so the app can't read it
 * from PostgREST — this serves one localized lesson: sections (text, code,
 * images), the quiz, video pointers, plus prev/next metadata. Same public,
 * cacheable teaching content as the catalog route.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const trackSlug = params.get("track") ?? "";
  const lessonSlug = params.get("lesson") ?? "";
  const lang = params.get("lang") === "my" ? "my" : "en";

  const found = getLesson(trackSlug, lessonSlug);
  if (!found) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const { track, lesson } = localizeLesson(found.track, found.lesson, lang);
  const index = track.lessons.findIndex((l) => l.slug === lesson.slug);
  const next = index >= 0 ? track.lessons[index + 1] : undefined;

  return NextResponse.json(
    {
      track: { slug: track.slug, title: track.title },
      position: index + 1,
      total: track.lessons.length,
      lesson: {
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        minutes: lesson.minutes,
        kind: lesson.kind,
        sections: lesson.sections ?? [],
        quiz: lesson.quiz ?? [],
        youtubeId: lesson.youtubeId ?? null,
        youtubeQuery: lesson.youtubeQuery ?? null,
      },
      next: next ? { slug: next.slug, title: next.title } : null,
    },
    {
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
