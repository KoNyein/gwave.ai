"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().trim().max(80).nullish(),
  bio: z.string().trim().max(500).nullish(),
  avatar_url: z.string().trim().max(1000).nullish(),
  cover_url: z.string().trim().max(1000).nullish(),
  presence_status: z
    .enum(["available", "busy", "away", "sleep", "invisible"])
    .optional(),
});

/** Update the caller's own profile (name, bio, photos, status). */
export async function updateProfile(
  input: z.input<typeof schema>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid profile details." };

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Only send fields the caller actually provided.
  const patch: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.full_name !== undefined) patch.full_name = d.full_name || null;
  if (d.bio !== undefined) patch.bio = d.bio || null;
  if (d.avatar_url !== undefined) patch.avatar_url = d.avatar_url || null;
  if (d.cover_url !== undefined) patch.cover_url = d.cover_url || null;
  if (d.presence_status !== undefined) patch.presence_status = d.presence_status;
  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, data: undefined };
}
