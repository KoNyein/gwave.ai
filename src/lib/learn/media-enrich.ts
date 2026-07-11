// Shared lesson-enrichment helper: merges teaching diagrams and hands-on
// code sections into a track's lessons at assembly time. Used by the
// per-track media modules (robotics-media, electronics-media, ai-media).
// Pure data transform, safe on server and client.

import type { Lesson, LessonSection } from "@/lib/learn/lessons";

export type LessonImage = NonNullable<LessonSection["image"]>;

export interface CodeExtra {
  heading: string;
  body: string;
  code: string;
}

/**
 * Attach a diagram to each matched lesson's first section and append a
 * hands-on code section. Lessons without an entry pass through unchanged.
 */
export function enrichLessons(
  lessons: Lesson[],
  images: Record<string, LessonImage>,
  code: Record<string, CodeExtra>,
): Lesson[] {
  return lessons.map((lesson) => {
    const image = images[lesson.slug];
    const extra = code[lesson.slug];
    if (!image && !extra) return lesson;

    let sections = lesson.sections ? [...lesson.sections] : [];
    if (image && sections.length > 0) {
      const first = sections[0]!;
      sections[0] = first.image ? first : { ...first, image };
    }
    if (extra) {
      sections = [
        ...sections,
        { heading: extra.heading, body: extra.body, code: extra.code },
      ];
    }
    return { ...lesson, sections };
  });
}
