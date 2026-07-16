import "server-only";

import { SignJWT, importPKCS8, importJWK, jwtVerify, type JWTPayload } from "jose";

import { authEnv } from "@/lib/env";

/**
 * The app's own data-plane token. After Cognito authenticates a user we mint
 * one of these: a short-lived ES256 JWT whose `sub` is the user's profiles.id
 * and whose `role` is `authenticated`. PostgREST and Realtime are configured to
 * trust our public JWKS, and RDS's `auth.uid()` reads `sub`, so all 226 RLS
 * policies resolve to the correct user. This is the token supabase-js sends as
 * its bearer to the /sb gateway — Cognito's own tokens never reach the data plane.
 */

const ALG = "ES256";
const AUDIENCE = "authenticated";
export const DATA_TOKEN_TTL_SECONDS = 60 * 60; // 1h — matches Cognito access token

let signingKeyPromise: Promise<CryptoKey> | null = null;
let verifyKeyPromise: Promise<CryptoKey> | null = null;

function signingKey(): Promise<CryptoKey> {
  if (!signingKeyPromise) {
    signingKeyPromise = importPKCS8(authEnv.jwtPrivateKeyPem, ALG) as Promise<CryptoKey>;
  }
  return signingKeyPromise;
}

function verifyKey(): Promise<CryptoKey> {
  if (!verifyKeyPromise) {
    verifyKeyPromise = importJWK(authEnv.jwtPublicJwk, ALG) as Promise<CryptoKey>;
  }
  return verifyKeyPromise;
}

export interface DataClaims {
  /** profiles.id — what every RLS policy resolves the user to. */
  sub: string;
  email?: string;
  exp: number;
}

/**
 * Mint a data token for a profile. Kept deliberately small: `sub` (profile id),
 * `role`/`aud` = authenticated, and optionally the email for convenience. The
 * `kid` header lets PostgREST/Realtime pick our key out of a JWKS that also
 * still holds Supabase's key during the transition.
 */
export async function mintDataToken(
  profileId: string,
  opts: { email?: string; ttlSeconds?: number } = {},
): Promise<string> {
  const kid = authEnv.jwtPublicJwk.kid as string;
  const claims: JWTPayload = { role: "authenticated" };
  if (opts.email) claims.email = opts.email;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG, kid, typ: "JWT" })
    .setSubject(profileId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${opts.ttlSeconds ?? DATA_TOKEN_TTL_SECONDS}s`)
    .sign(await signingKey());
}

let serviceToken: { token: string; expiresAt: number } | null = null;

/**
 * Mint (and briefly cache) a service_role token — the RDS `service_role` has
 * BYPASSRLS, so this is the AWS-native replacement for Supabase's service role
 * key. Used only in trusted server contexts (admin client, webhooks). Cached and
 * re-minted a little before expiry to avoid signing on every request.
 */
export async function mintServiceToken(): Promise<string> {
  const now = Date.now();
  if (serviceToken && serviceToken.expiresAt - 30_000 > now) {
    return serviceToken.token;
  }
  const kid = authEnv.jwtPublicJwk.kid as string;
  const ttl = 300; // 5 minutes
  const token = await new SignJWT({ role: "service_role" })
    .setProtectedHeader({ alg: ALG, kid, typ: "JWT" })
    .setSubject("service_role")
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(await signingKey());
  serviceToken = { token, expiresAt: now + ttl * 1000 };
  return token;
}

/**
 * Verify a data token locally (no network) and return its claims, or null if it
 * is missing, malformed, expired or signed by anything but our key. Used by the
 * session layer to answer "who is this request?" without a round-trip.
 */
export async function verifyDataToken(token: string | undefined): Promise<DataClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await verifyKey(), {
      algorithms: [ALG],
      audience: AUDIENCE,
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}
