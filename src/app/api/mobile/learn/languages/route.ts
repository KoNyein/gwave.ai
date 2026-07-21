import { NextRequest, NextResponse } from "next/server";

import { LANG_COURSES, LANG_UI, MY_UI } from "@/lib/learn/languages";

export const runtime = "nodejs";

/**
 * GET /api/mobile/learn/languages — language courses for the native app.
 *
 * Without `?course=`: the course catalog (slug, labels, flag, description,
 * unit count) — small, for the Languages home screen.
 * With `?course=<slug>`: that course in full — every unit with its phrases
 * (target, romanisation, Burmese meaning, emoji) plus the bilingual UI labels,
 * so the app can render flashcards and speak items with the device TTS
 * (bcp47). Static bundle content, cacheable.
 */
export function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("course");
  const headers = {
    "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
  };

  if (!slug) {
    return NextResponse.json(
      {
        courses: LANG_COURSES.map((c) => ({
          slug: c.slug,
          label: c.label,
          nativeLabel: c.nativeLabel,
          flag: c.flag,
          bcp47: c.bcp47,
          description: c.description,
          unitCount: c.units.length,
          phraseCount: c.units.reduce((n, u) => n + u.items.length, 0),
        })),
      },
      { headers },
    );
  }

  const course = LANG_COURSES.find((c) => c.slug === slug);
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }
  return NextResponse.json(
    {
      course,
      ui: { my: MY_UI, target: LANG_UI[course.slug] ?? LANG_UI.english },
    },
    { headers },
  );
}
