import "server-only";

import { getCognitoConfig, type CognitoConfig } from "@/lib/env";

/**
 * Amazon Cognito Hosted UI (OIDC, Authorization Code flow) helpers for the auth
 * migration. See docs/COGNITO_SETUP.md for the pool/app-client setup these
 * assume: a confidential client, `openid email profile` scopes, and Cognito +
 * Google as identity providers.
 *
 * These are pure request builders / token exchangers. They never run until
 * COGNITO_* env vars are set (getCognitoConfig() returns null otherwise), so
 * importing this module changes nothing about the live Supabase auth path.
 *
 * The token endpoint is called directly over TLS against the Cognito issuer, so
 * the tokens it returns are authentic without a separate JWKS signature check —
 * Supabase re-validates them against the issuer's JWKS on every DB request.
 */

export type CognitoTokens = {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export type CognitoIdClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
};

function requireConfig(): CognitoConfig {
  const cfg = getCognitoConfig();
  if (!cfg) {
    throw new Error("Cognito is not configured (COGNITO_* env vars missing).");
  }
  return cfg;
}

/** HTTP Basic auth header for the confidential client (id:secret). */
function basicAuthHeader(cfg: CognitoConfig): string {
  const raw = `${cfg.clientId}:${cfg.clientSecret}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

/**
 * Hosted UI authorize URL. Send the browser here to sign in; `idpHint` can
 * pre-select "Google" so the Google button skips the Cognito chooser.
 */
export function authorizeUrl(opts: {
  redirectUri: string;
  state: string;
  idpHint?: "Google" | "COGNITO";
}): string {
  const cfg = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: opts.redirectUri,
    scope: "openid email profile",
    state: opts.state,
  });
  if (opts.idpHint) params.set("identity_provider", opts.idpHint);
  return `${cfg.domain}/oauth2/authorize?${params.toString()}`;
}

/** Exchange an authorization code (from /auth/callback) for tokens. */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<CognitoTokens> {
  const cfg = requireConfig();
  const res = await fetch(`${cfg.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(cfg),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cfg.clientId,
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Cognito token exchange failed (${res.status}).`);
  }
  return (await res.json()) as CognitoTokens;
}

/** Trade a refresh token for a fresh access/id token (session refresh). */
export async function refreshTokens(
  refreshToken: string,
): Promise<CognitoTokens> {
  const cfg = requireConfig();
  const res = await fetch(`${cfg.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(cfg),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: cfg.clientId,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Cognito token refresh failed (${res.status}).`);
  }
  return (await res.json()) as CognitoTokens;
}

/**
 * Decode the ID token's claims WITHOUT verifying the signature. Safe only for
 * tokens just fetched from the token endpoint over TLS (their authenticity
 * comes from the transport, not the signature). Never trust a token from the
 * browser this way — Supabase verifies the JWKS signature for DB access.
 */
export function decodeIdToken(idToken: string): CognitoIdClaims {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Malformed ID token.");
  const json = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(json) as CognitoIdClaims;
}

/** Hosted UI logout URL — clears the Cognito session then returns to `logoutUri`. */
export function logoutUrl(logoutUri: string): string {
  const cfg = requireConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    logout_uri: logoutUri,
  });
  return `${cfg.domain}/logout?${params.toString()}`;
}
