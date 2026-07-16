import "server-only";

import { cookies } from "next/headers";

import {
  refreshCognitoTokens,
  type CognitoIdentity,
} from "@/lib/auth/cognito";
import {
  DATA_TOKEN_TTL_SECONDS,
  mintDataToken,
  verifyDataToken,
} from "@/lib/auth/tokens";

/**
 * Cookie-backed session for the AWS-native auth stack.
 *
 * - `gw_at` — the app's data token (our minted ES256 JWT). Readable by the
 *   browser (NOT httpOnly) so the client-side supabase data client can attach it
 *   as its bearer, exactly as Supabase's own access token was readable. Short
 *   lived (1h).
 * - `gw_rt` / `gw_cu` — the Cognito refresh token and username. httpOnly: only
 *   the server refreshes the session.
 */
export const AT_COOKIE = "gw_at";
const RT_COOKIE = "gw_rt";
export const CU_COOKIE = "gw_cu";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — matches Cognito refresh token

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export interface Session {
  /** profiles.id */
  id: string;
  email?: string;
}

function baseOptions() {
  return {
    secure: true,
    sameSite: "lax" as const,
    path: "/",
  };
}

/** Write a fresh session from a Cognito authentication result. */
export async function setSession(identity: CognitoIdentity): Promise<void> {
  const store = await cookies();
  const token = await mintDataToken(identity.profileId, { email: identity.email });

  store.set(AT_COOKIE, token, {
    ...baseOptions(),
    httpOnly: false,
    maxAge: DATA_TOKEN_TTL_SECONDS,
  });
  if (identity.refreshToken) {
    store.set(RT_COOKIE, identity.refreshToken, {
      ...baseOptions(),
      httpOnly: true,
      maxAge: REFRESH_MAX_AGE,
    });
  }
  store.set(CU_COOKIE, identity.cognitoUsername, {
    ...baseOptions(),
    httpOnly: true,
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  for (const name of [AT_COOKIE, RT_COOKIE, CU_COOKIE]) {
    store.delete(name);
  }
}

/**
 * The current user from the data token, or null. Local verify only (no network),
 * so it is cheap enough to call from every request. Does not attempt a refresh —
 * middleware owns that, since only it can reliably write cookies.
 */
export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  const claims = await verifyDataToken(store.get(AT_COOKIE)?.value);
  if (!claims) return null;
  return { id: claims.sub, email: claims.email };
}

/** The raw data token to hand the supabase data client as its bearer. */
export async function getDataToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(AT_COOKIE)?.value ?? null;
}

/**
 * Middleware-side refresh. If the data token is still valid, returns the session
 * and writes nothing. If it has expired but a Cognito refresh token is present,
 * exchanges it, re-mints the data token, writes the cookies onto `writeStore`
 * (the response cookie jar), and returns the session. Returns null when there is
 * no usable session — the caller then treats the request as anonymous.
 */
export async function refreshSession(
  readStore: CookieStore,
  writeStore: CookieStore,
): Promise<Session | null> {
  const existing = await verifyDataToken(readStore.get(AT_COOKIE)?.value);
  if (existing) return { id: existing.sub, email: existing.email };

  const refreshToken = readStore.get(RT_COOKIE)?.value;
  const cognitoUsername = readStore.get(CU_COOKIE)?.value;
  if (!refreshToken || !cognitoUsername) return null;

  const identity = await refreshCognitoTokens(refreshToken, cognitoUsername);
  if (!identity) return null;

  const token = await mintDataToken(identity.profileId, { email: identity.email });
  writeStore.set(AT_COOKIE, token, {
    ...baseOptions(),
    httpOnly: false,
    maxAge: DATA_TOKEN_TTL_SECONDS,
  });
  return { id: identity.profileId, email: identity.email };
}
