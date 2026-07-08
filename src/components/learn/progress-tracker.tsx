"use client";

import * as React from "react";

import { upsertLessonProgress } from "@/lib/actions/learn";

// Reading lessons report scroll depth as progress. Progress is sent once per
// threshold (25/50/75/100) so a whole read costs at most four requests; the
// server keeps the maximum, so scrolling back up never regresses anything.
const THRESHOLDS = [25, 50, 75, 100] as const;

export function ReadingProgressTracker({
  trackSlug,
  lessonSlug,
}: {
  trackSlug: string;
  lessonSlug: string;
}) {
  const sent = React.useRef(new Set<number>());

  React.useEffect(() => {
    // Mark the lesson as started immediately.
    void upsertLessonProgress({ trackSlug, lessonSlug, progressPct: 10 });

    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // Short pages have nothing to scroll — reading them counts as done.
      const pct =
        scrollable <= 0
          ? 100
          : Math.min(100, Math.round((window.scrollY / scrollable) * 100));

      for (const threshold of THRESHOLDS) {
        if (pct >= threshold && !sent.current.has(threshold)) {
          sent.current.add(threshold);
          void upsertLessonProgress({
            trackSlug,
            lessonSlug,
            progressPct: threshold,
            completed: threshold === 100,
          });
        }
      }
    }

    // Run once for pages that fit the viewport, then follow the scroll.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [trackSlug, lessonSlug]);

  return null;
}

/**
 * For game/quiz/code lessons: just record that the lesson was opened, so the
 * resume banner can point back to it. Completion is reported by the activity
 * itself, never by scrolling.
 */
export function LessonStartMarker({
  trackSlug,
  lessonSlug,
}: {
  trackSlug: string;
  lessonSlug: string;
}) {
  React.useEffect(() => {
    void upsertLessonProgress({ trackSlug, lessonSlug, progressPct: 10 });
  }, [trackSlug, lessonSlug]);
  return null;
}
