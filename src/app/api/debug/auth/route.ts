import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  cognitoEnabledPublic,
  getCognitoConfig,
  publicEnv,
} from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Cognito integration health — no secret values, only presence and agreement.
 * The common failure after a secret rotation is a half-state: the browser flag
 * says Cognito but a missing/typo'd COGNITO_* var makes the server fall back to
 * Supabase (or vice-versa), so logins go nowhere.
 */
async function cognitoDiag() {
  const cfg = getCognitoConfig();
  const serverEnabled = cfg !== null;
  const publicEnabled = cognitoEnabledPublic;
  const store = await cookies();
  const present = {
    COGNITO_REGION: Boolean(process.env.COGNITO_REGION?.trim()),
    COGNITO_USER_POOL_ID: Boolean(process.env.COGNITO_USER_POOL_ID?.trim()),
    COGNITO_CLIENT_ID: Boolean(process.env.COGNITO_CLIENT_ID?.trim()),
    COGNITO_CLIENT_SECRET: Boolean(process.env.COGNITO_CLIENT_SECRET?.trim()),
    COGNITO_DOMAIN: Boolean(process.env.COGNITO_DOMAIN?.trim()),
  };
  const missing = Object.entries(present)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  const mismatch = serverEnabled !== publicEnabled;
  return {
    server_enabled: serverEnabled,
    public_flag_enabled: publicEnabled,
    mismatch,
    env_present: present,
    env_missing: missing,
    issuer: cfg?.issuer ?? null,
    session_cookies: {
      gw_at: Boolean(store.get("gw_at")),
      gw_it: Boolean(store.get("gw_it")),
      gw_rt: Boolean(store.get("gw_rt")),
    },
    verdict: mismatch
      ? `BROKEN_HALF_STATE — server ${serverEnabled ? "uses" : "does NOT use"} Cognito but the browser flag ${publicEnabled ? "expects" : "does not expect"} it. ${
          missing.length
            ? `Set the missing server var(s): ${missing.join(", ")}.`
            : "Make NEXT_PUBLIC_COGNITO_ENABLED match, then rebuild."
        }`
      : serverEnabled
        ? "COGNITO_ON — server and browser agree on Cognito."
        : "SUPABASE_MODE — Cognito is off; app uses Supabase Auth.",
  };
}

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
  if (!key) return "MISSING — set this key in the server .env";
  // Both formats are accepted by supabase-js as the apikey. The legacy JWT keys
  // (eyJ…) and the new publishable/secret keys (sb_…) both work; the app only
  // passes them through to createClient and never decodes them. So key format
  // is not a cause of auth failures on its own.
  if (key.startsWith("eyJ")) return "legacy-jwt (ok)";
  if (key.startsWith("sb_publishable_")) return "sb_publishable (ok, new format)";
  if (key.startsWith("sb_secret_")) return "sb_secret (ok, new format)";
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
        ? "SESSION_NOT_REACHING_DB — the login works but the database sees you as anonymous. Confirm the Supabase URL/keys in the server .env are all from the same project and redeploy; under Cognito, also confirm the Cognito issuer is registered under Supabase → Authentication → Third-Party Auth."
        : "PROFILE_MISSING_OR_KEYS — profile row not found and/or session not reaching the database. Check the key kinds below and finish onboarding.";

  return NextResponse.json({
    verdict,
    cognito: await cognitoDiag(),
    logged_in_user: user?.id ?? null,
    db_sees_session: dbSeesSession,
    db_error: dbError,
    profile_row_exists: profileRowExists,
    anon_key_kind: keyKind(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    service_key_kind: keyKind(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
