"use server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getLesson } from "@/lib/learn/lessons";
import { createClient } from "@/lib/supabase/server";

export type LearnActionResult = { ok: true } | { ok: false; error: string };

const slugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/);

const progressSchema = z.object({
  trackSlug: slugSchema,
  lessonSlug: slugSchema,
  progressPct: z.number().int().min(0).max(100).optional(),
  completed: z.boolean().optional(),
  score: z.number().int().min(0).max(100).optional(),
});

/**
 * Record lesson activity. Server-authoritative: progress never goes
 * backwards and a completed lesson never reverts to in_progress, no matter
 * what the client sends.
 */
export async function upsertLessonProgress(input: {
  trackSlug: string;
  lessonSlug: string;
  progressPct?: number;
  completed?: boolean;
  score?: number;
}): Promise<LearnActionResult> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid progress." };
  const { trackSlug, lessonSlug, progressPct, completed, score } = parsed.data;

  // Only real lessons may create rows.
  if (!getLesson(trackSlug, lessonSlug)) {
    return { ok: false, error: "Unknown lesson." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("track_slug", trackSlug)
    .eq("lesson_slug", lessonSlug)
    .maybeSingle();

  const wasCompleted = existing?.status === "completed";
  const nowCompleted = wasCompleted || completed === true;
  const mergedPct = Math.max(
    existing?.progress_pct ?? 0,
    progressPct ?? 0,
    nowCompleted ? 100 : 0,
  );
  const mergedScore =
    score !== undefined
      ? Math.max(existing?.score ?? 0, score)
      : (existing?.score ?? null);

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      track_slug: trackSlug,
      lesson_slug: lessonSlug,
      status: nowCompleted ? "completed" : "in_progress",
      progress_pct: mergedPct,
      score: mergedScore,
      last_viewed_at: new Date().toISOString(),
      completed_at: nowCompleted
        ? (existing?.completed_at ?? new Date().toISOString())
        : null,
    },
    { onConflict: "user_id,track_slug,lesson_slug" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const projectSchema = z.object({
  trackSlug: slugSchema,
  lessonSlug: slugSchema,
  kind: z.string().min(1).max(30),
  title: z.string().min(1).max(120),
  data: z.record(z.unknown()),
});

// Saved project payloads are small game/editor states; cap them so nobody
// can stuff megabytes of jsonb through the action.
const MAX_PROJECT_BYTES = 20_000;

/** Auto-save a game/playground state so the learner can resume later. */
export async function saveProject(input: {
  trackSlug: string;
  lessonSlug: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
}): Promise<LearnActionResult> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid project." };
  const { trackSlug, lessonSlug, kind, title, data } = parsed.data;

  // The free-practice playground saves like a lesson but isn't in the
  // catalog; everything else must be a real lesson.
  const isFreePractice =
    trackSlug === "playground" && lessonSlug === "free-practice";
  if (!isFreePractice && !getLesson(trackSlug, lessonSlug)) {
    return { ok: false, error: "Unknown lesson." };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return { ok: false, error: "Project state is not serializable." };
  }
  if (serialized.length > MAX_PROJECT_BYTES) {
    return { ok: false, error: "Project is too large to save." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("member_projects").upsert(
    {
      user_id: user.id,
      track_slug: trackSlug,
      lesson_slug: lessonSlug,
      kind,
      title,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,track_slug,lesson_slug" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
