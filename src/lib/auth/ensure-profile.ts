import "server-only";

import { createAdminClient } from "@/lib/data/admin";

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
      .select("id, username")
      .eq("id", profileId)
      .maybeSingle();

    // Every web page treats a missing username as "onboarding not done" and
    // redirects to /onboarding — which, inside the app's signed-in web views
    // (messenger calls, G-Pay, health...), walled app-registered accounts out
    // of every web feature. Give app-minted profiles a generated username up
    // front (users can still change it in onboarding/settings), and back-fill
    // existing rows on their next token mint so old accounts self-heal.
    const fallbackUsername = `user_${profileId.replace(/-/g, "").slice(0, 10)}`;

    if (existing) {
      if (!existing.username) {
        await admin
          .from("profiles")
          .update({ username: fallbackUsername })
          .eq("id", profileId)
          .is("username", null);
      }
      return;
    }

    const { error } = await admin.from("profiles").insert({
      id: profileId,
      username: fallbackUsername,
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
