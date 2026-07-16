"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

import { TRACKS } from "@/lib/learn/lessons";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";

/**
 * Award a course-completion certificate. Eligibility is verified entirely
 * server-side: every lesson of the track must be marked completed in
 * lesson_progress. The insert uses the service role because the
 * certificates table deliberately has no client insert policy.
 */
export async function claimCertificate(
  trackSlug: string,
): Promise<ActionResult<{ certificateId: string }>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const track = TRACKS.find((t) => t.slug === trackSlug);
  if (!track) return { ok: false, error: "Unknown course" };
  const totalLessons = track.lessons.length;

  const { count } = await supabase
    .from("lesson_progress")
    .select("lesson_slug", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("track_slug", trackSlug)
    .eq("status", "completed")
    .in(
      "lesson_slug",
      track.lessons.map((l) => l.slug),
    );

  if ((count ?? 0) < totalLessons) {
    return {
      ok: false,
      error: `သင်ခန်းစာ ${count ?? 0}/${totalLessons} ပြီးပါသေးသည် — အားလုံးပြီးမှ လက်မှတ် ထုတ်နိုင်ပါသည်`,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("certificates")
    .upsert(
      {
        user_id: user.id,
        track_slug: trackSlug,
        track_title: track.title,
        lessons_completed: totalLessons,
      },
      { onConflict: "user_id,track_slug" },
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/learn/${trackSlug}`);
  return { ok: true, data: { certificateId: data.id as string } };
}
