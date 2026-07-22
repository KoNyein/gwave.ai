import "server-only";

import { createClient } from "@/lib/data/server";
import type { TeacherApplication } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface TeacherApplicationWithUser extends TeacherApplication {
  user: AuthorSummary;
}

/** The signed-in user's own teacher application, if any. */
export async function getMyTeacherApplication(
  userId: string,
): Promise<TeacherApplication | null> {
  const db = await createClient();
  const { data } = await db
    .from("teacher_applications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<TeacherApplication>();
  return data;
}

/** Review queue for moderators: pending first, then recent decisions. */
export async function getTeacherApplications(): Promise<
  TeacherApplicationWithUser[]
> {
  const db = await createClient();
  const { data } = await db
    .from("teacher_applications")
    .select(
      "*, user:profiles!teacher_applications_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<TeacherApplicationWithUser[]>();
  const apps = data ?? [];
  return [
    ...apps.filter((a) => a.status === "pending"),
    ...apps.filter((a) => a.status !== "pending"),
  ];
}
