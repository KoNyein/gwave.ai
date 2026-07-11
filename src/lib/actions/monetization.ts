"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

/** Opt in / out of creator monetization (earning from reels). */
export async function setMonetization(
  enabled: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_monetization", {
    p_enabled: enabled,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}
