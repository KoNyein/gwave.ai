// Lesson-content localization. The site language picker (next-intl cookie)
// already switches the UI; these overlays make it switch the LESSONS too.
// An overlay contains per-locale text for titles, summaries, section
// headings/bodies and quiz questions — code samples are never translated.
// Missing entries fall back to the English originals, so partially
// translated locales degrade gracefully.

import type { Lesson, Track } from "@/lib/learn/lessons";
import { MY_OVERLAY } from "@/lib/learn/i18n/my";

export interface SectionI18n {
  heading?: string;
  body?: string;
  /** Localized caption for the section's teaching image. */
  caption?: string;
  /** Localized alt text; falls back to the caption when omitted. */
  alt?: string;
}

export interface QuizI18n {
  q?: string;
  options?: string[];
  explain?: string;
}

export interface LessonI18n {
  title?: string;
  summary?: string;
  /** By section index; sparse entries allowed. */
  sections?: (SectionI18n | undefined)[];
  /** By question index; sparse entries allowed. */
  quiz?: (QuizI18n | undefined)[];
  /** Localized YouTube search phrase (Burmese results for `my`, etc.). */
  youtubeQuery?: string;
}

export interface TrackI18n {
  title?: string;
  description?: string;
  lessons?: Record<string, LessonI18n>;
}

export type LearnOverlay = Record<string, TrackI18n>;

// Burmese is fully translated; Thai/Chinese fall back to English for now —
// add overlays here as they are written.
const OVERLAYS: Record<string, LearnOverlay> = {
  my: MY_OVERLAY,
};

function localizeLessonData(lesson: Lesson, i18n?: LessonI18n): Lesson {
  if (!i18n) return lesson;
  return {
    ...lesson,
    title: i18n.title ?? lesson.title,
    summary: i18n.summary ?? lesson.summary,
    youtubeQuery: i18n.youtubeQuery ?? lesson.youtubeQuery,
    sections: lesson.sections?.map((section, index) => {
      const override = i18n.sections?.[index];
      if (!override) return section;
      return {
        ...section,
        heading: override.heading ?? section.heading,
        body: override.body ?? section.body,
        image: section.image
          ? {
              ...section.image,
              // Localize alt too; fall back to the localized caption so a
              // Burmese caption also gives Burmese screen-reader text.
              alt: override.alt ?? override.caption ?? section.image.alt,
              caption: override.caption ?? section.image.caption,
            }
          : section.image,
      };
    }),
    quiz: lesson.quiz?.map((question, index) => {
      const override = i18n.quiz?.[index];
      if (!override) return question;
      return {
        ...question,
        q: override.q ?? question.q,
        // Only take translated options when the count matches — the answer
        // index must keep pointing at the right choice.
        options:
          override.options && override.options.length === question.options.length
            ? override.options
            : question.options,
        explain: override.explain ?? question.explain,
      };
    }),
  };
}

/** A track with all display text swapped to the given locale. */
export function localizeTrack(track: Track, locale: string): Track {
  const overlay = OVERLAYS[locale]?.[track.slug];
  if (!overlay) return track;
  return {
    ...track,
    title: overlay.title ?? track.title,
    description: overlay.description ?? track.description,
    lessons: track.lessons.map((lesson) =>
      localizeLessonData(lesson, overlay.lessons?.[lesson.slug]),
    ),
  };
}

/** One localized lesson (with its localized track). */
export function localizeLesson(
  track: Track,
  lesson: Lesson,
  locale: string,
): { track: Track; lesson: Lesson } {
  const localized = localizeTrack(track, locale);
  return {
    track: localized,
    lesson:
      localized.lessons.find((l) => l.slug === lesson.slug) ?? lesson,
  };
}

/** Localized lesson title for banners (resume card etc.). */
export function localizedLessonTitle(
  trackSlug: string,
  lessonSlug: string,
  fallback: string,
  locale: string,
): string {
  return (
    OVERLAYS[locale]?.[trackSlug]?.lessons?.[lessonSlug]?.title ?? fallback
  );
}
