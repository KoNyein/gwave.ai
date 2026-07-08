import "server-only";

import { getLesson, getTrack } from "@/lib/learn/lessons";
import { createClient } from "@/lib/supabase/server";
import type { LessonProgress, MemberProject } from "@/types/database";

/** All progress rows for a user (RLS restricts to their own anyway). */
export async function getProgressForUser(
  userId: string,
): Promise<LessonProgress[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId);
  return data ?? [];
}

/** Progress rows for one track, keyed by lesson slug. */
export async function getTrackProgress(
  userId: string,
  trackSlug: string,
): Promise<Map<string, LessonProgress>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("track_slug", trackSlug);
  return new Map((data ?? []).map((row) => [row.lesson_slug, row]));
}

export interface ResumePoint {
  trackSlug: string;
  lessonSlug: string;
  trackTitle: string;
  lessonTitle: string;
  progressPct: number;
}

/**
 * The learner's most recent unfinished lesson — used for the "continue
 * learning" banner. Falls back to null when everything is done or nothing
 * was started. Rows referencing lessons that no longer exist are skipped.
 */
export async function getResumePointForUser(
  userId: string,
): Promise<ResumePoint | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("last_viewed_at", { ascending: false })
    .limit(5);

  for (const row of data ?? []) {
    const found = getLesson(row.track_slug, row.lesson_slug);
    if (found) {
      return {
        trackSlug: row.track_slug,
        lessonSlug: row.lesson_slug,
        trackTitle: found.track.title,
        lessonTitle: found.lesson.title,
        progressPct: row.progress_pct,
      };
    }
  }
  return null;
}

/** Saved project state for one lesson, or null. */
export async function getProjectForLesson(
  userId: string,
  trackSlug: string,
  lessonSlug: string,
): Promise<MemberProject | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_projects")
    .select("*")
    .eq("user_id", userId)
    .eq("track_slug", trackSlug)
    .eq("lesson_slug", lessonSlug)
    .maybeSingle();
  return data;
}

export interface ProjectSummary extends MemberProject {
  trackTitle: string;
}

/** The learner's saved projects, newest first, for the profile section. */
export async function getProjectsForUser(
  userId: string,
  limit = 12,
): Promise<ProjectSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((project) => ({
    ...project,
    trackTitle: getTrack(project.track_slug)?.title ?? project.track_slug,
  }));
}
