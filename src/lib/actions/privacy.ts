"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PrivacyResult = { ok: true } | { ok: false; error: string };

/**
 * Records a right-to-erasure request. Actual deletion is handled by an
 * operator/backend job (so it can cascade storage, backups, etc.), but this
 * captures the user's request with an auditable timestamp.
 */
export async function requestAccountDeletion(
  reason?: string,
): Promise<PrivacyResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("deletion_requests").upsert({
    user_id: profile.id,
    reason: reason?.slice(0, 1000) || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function cancelAccountDeletion(): Promise<PrivacyResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("deletion_requests")
    .delete()
    .eq("user_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/** Exports the user's own data (right to access / portability) as JSON. */
export async function exportMyData(): Promise<
  { ok: true; data: string } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const [posts, comments, friendships] = await Promise.all([
    supabase.from("posts").select("*").eq("author_id", profile.id),
    supabase.from("comments").select("*").eq("author_id", profile.id),
    supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`),
  ]);

  const bundle = {
    exported_at: new Date().toISOString(),
    profile,
    posts: posts.data ?? [],
    comments: comments.data ?? [],
    friendships: friendships.data ?? [],
  };
  return { ok: true, data: JSON.stringify(bundle, null, 2) };
}
