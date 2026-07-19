import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import {
  AdminConfirmSignUpCommand,
  AdminUpdateUserAttributesCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";

import { authEnv } from "@/lib/env";
import { cognito, identityFromTokens, secretHash } from "@/lib/auth/cognito";
import { DATA_TOKEN_TTL_SECONDS, mintDataToken } from "@/lib/auth/tokens";
import { checkAuthRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/auth/register — native (Flutter) sign-up. Mirrors the web
 * `register` server action: create the Cognito user with a fresh profile id,
 * confirm + verify server-side (no email code, to keep the sign-up → onboarding
 * flow), then sign in and return the data token so the app is authenticated
 * immediately.
 */
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }
  if (!(await checkAuthRateLimit("mobile-register", 5))) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429 },
    );
  }

  const { clientId, userPoolId } = authEnv.cognito;
  const profileId = randomUUID();
  const email = parsed.data.email;

  try {
    await cognito().send(
      new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: parsed.data.password,
        SecretHash: secretHash(email),
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "custom:profile_id", Value: profileId },
        ],
      }),
    );
    await cognito().send(
      new AdminConfirmSignUpCommand({ UserPoolId: userPoolId, Username: email }),
    );
    await cognito().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [{ Name: "email_verified", Value: "true" }],
      }),
    );
    const out = await cognito().send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: parsed.data.password,
          SECRET_HASH: secretHash(email),
        },
      }),
    );
    if (!out.AuthenticationResult) {
      return NextResponse.json(
        { error: "Could not sign you in after registration." },
        { status: 500 },
      );
    }

    const identity = identityFromTokens(out.AuthenticationResult);
    const token = await mintDataToken(identity.profileId, {
      email: identity.email,
    });

    return NextResponse.json({
      token,
      expiresIn: DATA_TOKEN_TTL_SECONDS,
      profileId: identity.profileId,
      email: identity.email ?? null,
      cognitoUsername: identity.cognitoUsername,
      refreshToken: identity.refreshToken ?? null,
      isNewUser: true,
    });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "UsernameExistsException") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    if (name === "InvalidPasswordException") {
      return NextResponse.json(
        { error: "Password does not meet the requirements." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
