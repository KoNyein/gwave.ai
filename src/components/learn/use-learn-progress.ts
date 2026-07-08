"use client";

import * as React from "react";

import { saveProject, upsertLessonProgress } from "@/lib/actions/learn";

/**
 * Identifies which lesson a game/playground belongs to so its state can be
 * persisted. When omitted the component behaves exactly as before (no
 * persistence) — e.g. when rendered outside a lesson.
 */
export interface LessonRef {
  trackSlug: string;
  lessonSlug: string;
  /** Saved state from the server to restore on mount, if any. */
  initialData?: Record<string, unknown> | null;
}

/**
 * Debounced auto-save of a project's state (2s after the last change) plus a
 * one-shot flush on unmount. Fire-and-forget: failures only log — the game
 * keeps working offline.
 */
export function useProjectAutosave(
  lesson: LessonRef | undefined,
  kind: string,
  title: string,
  data: Record<string, unknown>,
  enabled = true,
) {
  const latest = React.useRef({ data, dirty: false });
  latest.current.data = data;

  const persist = React.useCallback(() => {
    if (!lesson || !latest.current.dirty) return;
    latest.current.dirty = false;
    void saveProject({
      trackSlug: lesson.trackSlug,
      lessonSlug: lesson.lessonSlug,
      kind,
      title,
      data: latest.current.data,
    }).then((result) => {
      if (!result.ok) console.warn("Project autosave failed:", result.error);
    });
  }, [lesson, kind, title]);

  // Debounce: mark dirty on every change, save 2s after the last one.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (!lesson || !enabled) return;
    // Skip the initial render (restoring saved state is not a change).
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current.dirty = true;
    const timer = setTimeout(persist, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), lesson, enabled, persist]);

  // Flush pending changes when the component unmounts.
  React.useEffect(() => persist, [persist]);
}

/** Fire-and-forget completion mark (game won, quiz submitted…). */
export function reportLessonComplete(
  lesson: LessonRef | undefined,
  score?: number,
) {
  if (!lesson) return;
  void upsertLessonProgress({
    trackSlug: lesson.trackSlug,
    lessonSlug: lesson.lessonSlug,
    completed: true,
    ...(score !== undefined ? { score } : {}),
  }).then((result) => {
    if (!result.ok) console.warn("Progress update failed:", result.error);
  });
}
