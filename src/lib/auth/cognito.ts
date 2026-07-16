import "server-only";

import { createHmac } from "node:crypto";

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { decodeJwt } from "jose";

import { authEnv } from "@/lib/env";

/**
 * Thin wrapper around Cognito. Cognito is the credential store and identity
 * provider (email/password, Google federation, SMS later); it authenticates the
 * user and hands us an id token carrying `custom:profile_id`. From there the app
 * takes over and mints its own data token (see tokens.ts) — Cognito's tokens are
 * never sent to PostgREST/Realtime.
 */

let client: CognitoIdentityProviderClient | null = null;
export function cognito(): CognitoIdentityProviderClient {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: authEnv.cognito.region });
  }
  return client;
}

/**
 * The app client has a secret, so every user-pool call must include a
 * SECRET_HASH = base64(HMAC-SHA256(clientSecret, username + clientId)).
 */
export function secretHash(username: string): string {
  const { clientId, clientSecret } = authEnv.cognito;
  return createHmac("sha256", clientSecret).update(username + clientId).digest("base64");
}

export interface CognitoIdentity {
  /** The user's existing profiles.id, carried in custom:profile_id. */
  profileId: string;
  email?: string;
  /** Cognito's own username (sub) — needed to compute SECRET_HASH on refresh. */
  cognitoUsername: string;
  accessToken: string;
  idToken: string;
  refreshToken?: string;
}

/** Pull the profile id + email out of a Cognito id token (already trusted — it
 * came straight from Cognito over TLS). */
export function identityFromTokens(result: AuthenticationResultType): CognitoIdentity {
  const idToken = result.IdToken ?? "";
  const claims = decodeJwt(idToken);
  const profileId = claims["custom:profile_id"];
  if (typeof profileId !== "string" || !profileId) {
    throw new Error("Cognito user has no custom:profile_id — cannot map to a profile.");
  }
  return {
    profileId,
    email: typeof claims.email === "string" ? claims.email : undefined,
    cognitoUsername: (claims["cognito:username"] as string) ?? (claims.sub as string) ?? "",
    accessToken: result.AccessToken ?? "",
    idToken,
    refreshToken: result.RefreshToken,
  };
}

/**
 * Exchange a refresh token for fresh Cognito tokens. Cognito does not return a
 * new refresh token here, so the caller keeps the existing one. Returns null if
 * the refresh token is expired/revoked (the session is then over).
 */
export async function refreshCognitoTokens(
  refreshToken: string,
  cognitoUsername: string,
): Promise<CognitoIdentity | null> {
  try {
    const out = await cognito().send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: authEnv.cognito.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          SECRET_HASH: secretHash(cognitoUsername),
        },
      }),
    );
    if (!out.AuthenticationResult) return null;
    const identity = identityFromTokens(out.AuthenticationResult);
    identity.refreshToken = refreshToken; // reused — Cognito didn't rotate it
    return identity;
  } catch {
    return null;
  }
}
