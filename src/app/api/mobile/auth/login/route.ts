import { NextResponse } from "next/server";
import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";

import { authEnv } from "@/lib/env";
import { cognito, identityFromTokens, secretHash } from "@/lib/auth/cognito";
import { DATA_TOKEN_TTL_SECONDS, mintDataToken } from "@/lib/auth/tokens";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { checkAuthRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/auth/login — the native (Flutter) app's sign-in.
 *
 * The web app authenticates with Cognito inside a Server Action and stores the
 * minted data token in the `gw_at` cookie. Native apps can't share that cookie
 * jar, so this JSON twin runs the identical Cognito USER_PASSWORD_AUTH flow and
 * hands the same data token back in the body. The app keeps it in secure storage
 * and sends it as `Authorization: Bearer` to PostgREST — exactly what the browser
 * data client does — plus the Cognito refresh token + username so it can silently
 * re-mint via /api/mobile/auth/refresh.
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
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  }
  if (!(await checkAuthRateLimit("mobile-login", 10))) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429 },
    );
  }

  const { clientId } = authEnv.cognito;
  try {
    const out = await cognito().send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: parsed.data.email,
          PASSWORD: parsed.data.password,
          SECRET_HASH: secretHash(parsed.data.email),
        },
      }),
    );
    if (out.ChallengeName || !out.AuthenticationResult) {
      return NextResponse.json(
        { error: "Please reset your password to continue." },
        { status: 401 },
      );
    }

    const identity = identityFromTokens(out.AuthenticationResult);
    await ensureProfile(identity.profileId);
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
    });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 },
      );
    }
    if (name === "UserNotConfirmedException") {
      return NextResponse.json(
        { error: "Please confirm your account first." },
        { status: 403 },
      );
    }
    if (name === "TooManyRequestsException") {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
