import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import {
  AdminUpdateUserAttributesCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { decodeJwt } from "jose";
import { z } from "zod";

import { authEnv } from "@/lib/env";
import {
  cognito,
  identityFromTokens,
  refreshCognitoTokens,
  secretHash,
} from "@/lib/auth/cognito";
import { DATA_TOKEN_TTL_SECONDS, mintDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mobile counterpart of /auth/callback.
 *
 * The Flutter app can't use the browser flow: /auth/callback ends in cookies and
 * a redirect, and the app has neither a cookie jar nor a page to land on. It also
 * must not hold the Cognito client secret — an APK is a public client, anyone can
 * unzip it. So the app does only the half that needs no secret (open the Hosted UI,
 * catch the deep link, read `code`) and posts the code here; this route performs
 * the confidential half server-side and hands back the same ES256 data token the
 * web session carries, which the app then sends as its bearer to /sb.
 *
 * Cognito's own tokens still never reach the data plane — see lib/auth/tokens.ts.
 *
 * The redirect_uri must be echoed back to Cognito byte-for-byte, and it is the
 * one value here an attacker could otherwise steer, so it is allow-listed rather
 * than trusted. Both entries are already registered on the `gwave-web` client;
 * note `cc.gwave://login-callback` (the Supabase-era link) is NOT one of them and
 * Cognito rejects it with redirect_mismatch.
 */
const MOBILE_REDIRECT_URIS = ["gwave://auth/callback"] as const;

const body = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string().min(1).max(4096),
    redirect_uri: z.enum(MOBILE_REDIRECT_URIS),
    /** Present when the app used PKCE, which it should. */
    code_verifier: z.string().min(43).max(128).optional(),
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string().min(1).max(4096),
    /** Needed for the SECRET_HASH on a client that has a secret. */
    cognito_username: z.string().min(1).max(255),
  }),
  // The app keeps its own email/password form rather than sending people to the
  // Hosted UI for it. USER_PASSWORD_AUTH needs a SECRET_HASH, which needs the
  // client secret — so it has to run here, not in the APK.
  z.object({
    grant_type: z.literal("password"),
    email: z.string().email().max(320),
    password: z.string().min(1).max(256),
  }),
]);

interface TokenResponse {
  dataToken: string;
  expiresIn: number;
  profileId: string;
  cognitoUsername: string;
  email?: string;
  refreshToken?: string;
  needsOnboarding: boolean;
}

/** Has this profile finished onboarding? Mirrors the web callback's check. */
async function needsOnboarding(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("username")
    .eq("id", profileId)
    .maybeSingle();
  return !data?.username;
}

/**
 * Resolve the profiles.id every RLS policy keys off. A first-time Google user has
 * no custom:profile_id yet — mint one and back-fill it so later logins are stable.
 */
async function resolveProfileId(
  claims: Record<string, unknown>,
  cognitoUsername: string,
): Promise<string> {
  const claimed = claims["custom:profile_id"];
  if (typeof claimed === "string" && claimed) return claimed;

  const profileId = randomUUID();
  await cognito()
    .send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: authEnv.cognito.userPoolId,
        Username: cognitoUsername,
        UserAttributes: [{ Name: "custom:profile_id", Value: profileId }],
      }),
    )
    .catch(() => {});
  return profileId;
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  if (parsed.data.grant_type === "refresh_token") {
    const identity = await refreshCognitoTokens(
      parsed.data.refresh_token,
      parsed.data.cognito_username,
    );
    if (!identity) {
      return NextResponse.json({ error: "Refresh rejected." }, { status: 401 });
    }
    const payload: TokenResponse = {
      dataToken: await mintDataToken(identity.profileId, {
        email: identity.email,
      }),
      expiresIn: DATA_TOKEN_TTL_SECONDS,
      profileId: identity.profileId,
      cognitoUsername: identity.cognitoUsername,
      email: identity.email,
      refreshToken: identity.refreshToken,
      needsOnboarding: await needsOnboarding(identity.profileId),
    };
    return NextResponse.json(payload);
  }

  if (parsed.data.grant_type === "password") {
    const { email, password } = parsed.data;
    const out = await cognito()
      .send(
        new InitiateAuthCommand({
          AuthFlow: "USER_PASSWORD_AUTH",
          ClientId: authEnv.cognito.clientId,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
            SECRET_HASH: secretHash(email),
          },
        }),
      )
      .catch(() => null);

    if (!out?.AuthenticationResult) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 },
      );
    }
    // Throws when the account predates custom:profile_id — a migrated user who
    // has never signed in on the web. Surfacing it beats a confusing 500.
    let identity;
    try {
      identity = identityFromTokens(out.AuthenticationResult);
    } catch {
      return NextResponse.json(
        { error: "This account is not linked yet. Sign in on gwave.cc once." },
        { status: 409 },
      );
    }

    const payload: TokenResponse = {
      dataToken: await mintDataToken(identity.profileId, {
        email: identity.email,
      }),
      expiresIn: DATA_TOKEN_TTL_SECONDS,
      profileId: identity.profileId,
      cognitoUsername: identity.cognitoUsername,
      email: identity.email,
      refreshToken: identity.refreshToken,
      needsOnboarding: await needsOnboarding(identity.profileId),
    };
    return NextResponse.json(payload);
  }

  const { domain, clientId, clientSecret } = authEnv.cognito;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code: parsed.data.code,
    redirect_uri: parsed.data.redirect_uri,
  });
  if (parsed.data.code_verifier) {
    form.set("code_verifier", parsed.data.code_verifier);
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: form,
  }).catch(() => null);

  if (!res?.ok) {
    // Cognito's body names the real cause (invalid_grant on a replayed or expired
    // code, redirect_mismatch on the wrong deep link) — worth surfacing, it is not
    // sensitive and a mobile client has no other way to see it.
    const detail = res ? await res.text().catch(() => "") : "";
    return NextResponse.json(
      { error: "Token exchange failed.", detail: detail.slice(0, 300) },
      { status: 401 },
    );
  }

  const tokens = (await res.json()) as {
    id_token: string;
    access_token: string;
    refresh_token?: string;
  };
  const claims = decodeJwt(tokens.id_token) as Record<string, unknown>;
  const cognitoUsername =
    (claims["cognito:username"] as string) ?? (claims.sub as string) ?? "";
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const profileId = await resolveProfileId(claims, cognitoUsername);

  const payload: TokenResponse = {
    dataToken: await mintDataToken(profileId, { email }),
    expiresIn: DATA_TOKEN_TTL_SECONDS,
    profileId,
    cognitoUsername,
    email,
    refreshToken: tokens.refresh_token,
    needsOnboarding: await needsOnboarding(profileId),
  };
  return NextResponse.json(payload);
}
