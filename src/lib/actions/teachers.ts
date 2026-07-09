"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const applySchema = z.object({
  bio: z.string().trim().min(1).max(1000),
  subjects: z.string().trim().max(200),
});

/** Apply (or resubmit) to become a teacher who can host live classes. */
export async function applyToTeach(
  input: z.infer<typeof applySchema>,
): Promise<ActionResult> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid." };
  }
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };
  if (profile.is_teacher) return { ok: false, error: "Already a teacher." };

  const supabase = await createClient();
  // Resubmitting re-opens a rejected application as pending.
  const { error } = await supabase.from("teacher_applications").upsert(
    {
      user_id: profile.id,
      bio: parsed.data.bio,
      subjects: parsed.data.subjects || null,
      status: "pending",
      review_note: null,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/learn/teach");
  return { ok: true, data: undefined };
}

/**
 * Approve or reject a teacher application (moderators/admins). Approving
 * also flips the applicant's profiles.is_teacher via the service role,
 * since a user cannot grant themselves the flag.
 */
export async function reviewTeacherApplication(
  applicationId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<ActionResult> {
  const reviewer = await getCurrentProfile();
  if (!reviewer) return { ok: false, error: "Not authenticated." };
  const canReview = ["admin", "super_admin"].includes(reviewer.role);
  if (!canReview) return { ok: false, error: "Not allowed." };

  const supabase = await createClient();
  const { data: app, error } = await supabase
    .from("teacher_applications")
    .update({
      status: decision,
      review_note: note?.trim().slice(0, 500) || null,
    })
    .eq("id", applicationId)
    .select("user_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!app) return { ok: false, error: "Application not found." };

  // Grant/revoke the teacher flag with the service role.
  const admin = createAdminClient();
  const { error: flagError } = await admin
    .from("profiles")
    .update({ is_teacher: decision === "approved" })
    .eq("id", app.user_id);
  if (flagError) return { ok: false, error: flagError.message };

  revalidatePath("/admin/teachers");
  return { ok: true, data: undefined };
}
