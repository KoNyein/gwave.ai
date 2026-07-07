"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Block a user: hides their content from you (and yours from them). */
export async function blockUser(targetId: string): Promise<ActionResult> {
  if (!uuid.safeParse(targetId).success) {
    return { ok: false, error: "Invalid user." };
  }
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.id === targetId) {
    return { ok: false, error: "You can't block yourself." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: profile.id, blocked_id: targetId });
  // 23505 = already blocked; treat as success.
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unblockUser(targetId: string): Promise<ActionResult> {
  if (!uuid.safeParse(targetId).success) {
    return { ok: false, error: "Invalid user." };
  }
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .match({ blocker_id: profile.id, blocked_id: targetId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Is `targetId` currently blocked by the signed-in user? */
export async function isBlockedByMe(targetId: string): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .match({ blocker_id: profile.id, blocked_id: targetId })
    .maybeSingle();
  return Boolean(data);
}
