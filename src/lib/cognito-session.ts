import "server-only";

import { cookies } from "next/headers";

import {
  decodeIdToken,
  refreshTokens,
  type CognitoTokens,
} from "@/lib/cognito";
import { isCognitoEnabled } from "@/lib/env";

/**
 * Cognito session, stored in cookies (see docs/COGNITO_SETUP.md).
 *
 * - gw_at: the access token. Readable by browser JS on purpose — the browser
 *   Supabase client attaches it so Realtime/Storage/RLS see the same identity.
 *   Short-lived (Cognito default 60 min), so XSS exposure is time-boxed.
 * - gw_rt: the refresh token. httpOnly — only the server (middleware) uses it to
 *   mint fresh access tokens. 30-day lifetime to match the app client.
 * - gw_it: the id token. httpOnly — carries email/name/picture the server reads
 *   to identify the user and provision their profile.
 *
 * All three clear together on sign-out. Everything here is a no-op relative to
 * Supabase Auth until COGNITO_* is configured.
 */
export const COGNITO_AT_COOKIE = "gw_at";
export const COGNITO_RT_COOKIE = "gw_rt";
export const COGNITO_IT_COOKIE = "gw_it";
const OAUTH_STATE_COOKIE = "gw_oauth_state";

const RT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches refresh token expiry.

type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

function secureCookieBase() {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Persist a fresh set of Cognito tokens to cookies. */
export async function setCognitoSession(tokens: CognitoTokens): Promise<void> {
  const store = await cookies();
  const base = secureCookieBase();
  // Access token readable by the browser Supabase client; expires with the token.
  store.set(COGNITO_AT_COOKIE, tokens.access_token, {
    ...base,
    httpOnly: false,
    maxAge: tokens.expires_in,
  });
  store.set(COGNITO_IT_COOKIE, tokens.id_token, {
    ...base,
    httpOnly: true,
    maxAge: tokens.expires_in,
  });
  if (tokens.refresh_token) {
    store.set(COGNITO_RT_COOKIE, tokens.refresh_token, {
      ...base,
      httpOnly: true,
      maxAge: RT_MAX_AGE,
    });
  }
}

/** Remove every Cognito cookie (sign-out). */
export async function clearCognitoSession(): Promise<void> {
  const store = await cookies();
  store.delete(COGNITO_AT_COOKIE);
  store.delete(COGNITO_IT_COOKIE);
  store.delete(COGNITO_RT_COOKIE);
}

/** The current access token, or null when signed out. */
export async function getCognitoAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COGNITO_AT_COOKIE)?.value ?? null;
}

/**
 * The signed-in user derived from the id token cookie, or null. Shaped to mirror
 * the parts of a Supabase user the app reads (id, email).
 */
export async function getCognitoSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const idToken = store.get(COGNITO_IT_COOKIE)?.value;
  if (!idToken) return null;
  try {
    const c = decodeIdToken(idToken);
    if (!c.sub) return null;
    return {
      id: c.sub,
      email: c.email ?? null,
      name: c.name ?? null,
      avatarUrl: c.picture ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Begin an OAuth round-trip: encode the post-login destination in the `state`
 * parameter and stash a random CSRF token in a short-lived cookie. Returns the
 * `state` string to send to Cognito's authorize endpoint.
 */
export async function startOAuthState(next: string): Promise<string> {
  const csrf = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ n: next, c: csrf })).toString(
    "base64url",
  );
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, csrf, {
    ...secureCookieBase(),
    httpOnly: true,
    maxAge: 600, // 10 minutes to complete the login.
  });
  return state;
}

/**
 * Validate the `state` returned from Cognito against the CSRF cookie and return
 * the destination it carried. Returns null when the state is missing, malformed,
 * or doesn't match — the caller should then refuse the sign-in.
 */
export async function consumeOAuthState(
  state: string | null,
): Promise<string | null> {
  const store = await cookies();
  const expected = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);
  if (!state || !expected) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8"),
    ) as { n?: string; c?: string };
    if (parsed.c !== expected) return null;
    const next = parsed.n ?? "/feed";
    return next.startsWith("/") && !next.startsWith("//") ? next : "/feed";
  } catch {
    return null;
  }
}

/**
 * Refresh the access/id tokens from the refresh cookie when the access token is
 * gone but a refresh token remains. Returns true when a refresh happened. Called
 * from middleware so server components always see a live token.
 */
export async function maybeRefreshCognitoSession(): Promise<boolean> {
  if (!isCognitoEnabled()) return false;
  const store = await cookies();
  if (store.get(COGNITO_AT_COOKIE)) return false; // still valid
  const refresh = store.get(COGNITO_RT_COOKIE)?.value;
  if (!refresh) return false;
  try {
    const tokens = await refreshTokens(refresh);
    // Cognito omits refresh_token on refresh; keep the existing one.
    await setCognitoSession({ ...tokens, refresh_token: tokens.refresh_token });
    return true;
  } catch {
    await clearCognitoSession();
    return false;
  }
}
