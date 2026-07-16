import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/auth — self-service auth diagnostics.
 *
 * Answers, in one page, the question "why does posting fail with an RLS
 * error?": whether the user is logged in (Cognito), whether the app's minted
 * data token (the `gw_at` cookie) actually reaches PostgREST as auth.uid(),
 * and whether the profile row exists. Exposes only the caller's own user id.
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  let dbSeesSession: boolean | null = null;
  let dbError: string | null = null;
  let profileRowExists: boolean | null = null;

  if (user) {
    // Profiles are readable by any *authenticated* DB session, so an empty
    // result for our own row means the JWT never reached PostgREST.
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    dbSeesSession = Boolean(data);
    dbError = error?.message ?? null;

    // Service-role check: does the profile row exist at all?
    try {
      const admin = createAdminClient();
      const { data: adminRow } = await admin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      profileRowExists = Boolean(adminRow);
    } catch {
      profileRowExists = null;
    }
  }

  const verdict = !user
    ? "NOT_LOGGED_IN — log in first, then open this page again."
    : dbSeesSession
      ? profileRowExists === false
        ? "PROFILE_MISSING — the account has no profile row; finish onboarding (/onboarding)."
        : "AUTH_OK — the database sees your session. Posting should work; if it still fails, send me the exact error."
      : profileRowExists
        ? "SESSION_NOT_REACHING_DB — the login works but the database sees you as anonymous. Log out and back in to refresh your data token (gw_at); if it persists, the token isn't reaching PostgREST — check the /sb gateway and that the app's JWKS is trusted."
        : "PROFILE_MISSING_OR_SESSION — profile row not found and/or session not reaching the database. Log in again, then finish onboarding (/onboarding).";

  return NextResponse.json({
    verdict,
    logged_in_user: user?.id ?? null,
    db_sees_session: dbSeesSession,
    db_error: dbError,
    profile_row_exists: profileRowExists,
  });
}
