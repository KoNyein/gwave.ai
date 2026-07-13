import { NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/auth — self-service auth diagnostics.
 *
 * Answers, in one page, the question "why does posting fail with an RLS
 * error?": whether the browser session exists, whether the database
 * actually receives it (auth.uid()), whether the profile row exists, and
 * whether the configured Supabase keys are the legacy JWT format the app
 * requires. Exposes only the caller's own user id and key *formats* —
 * never key values.
 */
function keyKind(key: string | undefined): string {
  if (!key) return "missing";
  if (key.startsWith("eyJ")) return "legacy-jwt (correct)";
  if (key.startsWith("sb_publishable_")) {
    return "sb_publishable (WRONG — replace with the legacy eyJ… anon key)";
  }
  if (key.startsWith("sb_secret_")) {
    return "sb_secret (WRONG — replace with the legacy eyJ… service_role key)";
  }
  return `unknown format (${key.slice(0, 6)}…)`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        ? "SESSION_NOT_REACHING_DB — the login works but the database sees you as anonymous. Check NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the app's environment, then redeploy and log in again."
        : "PROFILE_MISSING_OR_KEYS — profile row not found and/or session not reaching the database. Check the key kinds below and finish onboarding.";

  return NextResponse.json({
    verdict,
    logged_in_user: user?.id ?? null,
    db_sees_session: dbSeesSession,
    db_error: dbError,
    profile_row_exists: profileRowExists,
    anon_key_kind: keyKind(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    service_key_kind: keyKind(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
