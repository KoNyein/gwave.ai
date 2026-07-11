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
 * A teaching video for a lesson: either a pinned YouTube id embedded at the
 * top of the lesson, or a search query that renders a "Watch on YouTube"
 * link (localized so Myanmar learners get Burmese results).
 */
export interface LessonVideo {
  youtubeId?: string;
  youtubeQuery?: string;
}

/**
 * Attach a diagram to each matched lesson's first section, append a hands-on
 * code section, and pin a teaching video — without overwriting anything a
 * lesson already declares. Lessons without any entry pass through unchanged.
 */
export function enrichLessons(
  lessons: Lesson[],
  images: Record<string, LessonImage>,
  code: Record<string, CodeExtra>,
  videos: Record<string, LessonVideo> = {},
): Lesson[] {
  return lessons.map((lesson) => {
    const image = images[lesson.slug];
    const extra = code[lesson.slug];
    const video = videos[lesson.slug];
    if (!image && !extra && !video) return lesson;

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

    const next: Lesson = { ...lesson, sections };
    // Only fill video fields the lesson hasn't already set for itself.
    if (video && !next.youtubeId && !next.youtubeQuery) {
      if (video.youtubeId) next.youtubeId = video.youtubeId;
      else if (video.youtubeQuery) next.youtubeQuery = video.youtubeQuery;
    }
    return next;
  });
}
