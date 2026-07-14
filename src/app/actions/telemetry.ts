"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Backfill the signed-in user's region signal (IANA timezone, e.g.
 * "Asia/Yangon") — only when it is not already set, so we never overwrite and
 * never track more than the coarse region. No-op for signed-out visitors.
 */
export async function captureTimezone(tz: string): Promise<void> {
  if (!tz || tz.length > 60) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ timezone: tz })
    .eq("id", user.id)
    .is("timezone", null);
}
