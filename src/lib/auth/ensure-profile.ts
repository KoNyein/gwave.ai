import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Make sure a `profiles` row exists for [profileId], creating it when missing.
 *
 * The mobile auth routes mint the profile id (and back-fill it onto the
 * Cognito user as custom:profile_id) but historically never inserted the
 * profiles row — the web /auth/callback did that. An app-only account
 * therefore had no profile, so every FK write failed: live_streams
 * (host_id_fkey), ptt_channels (owner_id_fkey), messages, comments, SOS,
 * G-Pay registration… and the user showed as "Gwave user" everywhere.
 *
 * Called from every mobile auth route that mints a data token — including
 * /refresh, so already-affected accounts self-heal on their next token
 * refresh without re-logging in. Never overwrites an existing row and never
 * fails the sign-in: auth must not break because provisioning hiccuped.
 */
export async function ensureProfile(
  profileId: string,
  details: { fullName?: string | null; avatarUrl?: string | null } = {},
): Promise<void> {
  if (!profileId) return;
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    if (existing) return;

    const { error } = await admin.from("profiles").insert({
      id: profileId,
      full_name: details.fullName ?? null,
      avatar_url: details.avatarUrl ?? null,
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.error("ensureProfile failed:", profileId, error.message);
    }
  } catch (e) {
    console.error("ensureProfile crashed:", profileId, e);
  }
}
