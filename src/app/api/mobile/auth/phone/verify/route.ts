import { NextResponse } from "next/server";
import {
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";

import { authEnv } from "@/lib/env";
import { cognito, identityFromTokens, secretHash } from "@/lib/auth/cognito";
import { DATA_TOKEN_TTL_SECONDS, mintDataToken } from "@/lib/auth/tokens";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { derivePhonePassword, normalizePhone } from "@/lib/auth/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/auth/phone/verify — confirm the SMS code and sign in.
 *
 * Confirms the Cognito sign-up with the texted code, then signs in with the
 * derived phone password and hands back the data token — same shape as the
 * email login, so the app treats the resulting session identically.
 */
const schema = z.object({
  phone: z.string().min(3),
  code: z.string().min(4).max(10),
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
    return NextResponse.json({ error: "Enter the code we texted you." }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const { clientId } = authEnv.cognito;
  const password = derivePhonePassword(phone);

  try {
    await cognito().send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: phone,
        ConfirmationCode: parsed.data.code.trim(),
        SecretHash: secretHash(phone),
      }),
    );
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "CodeMismatchException") {
      return NextResponse.json({ error: "Wrong code. Try again." }, { status: 400 });
    }
    if (name === "ExpiredCodeException") {
      return NextResponse.json({ error: "That code expired." }, { status: 400 });
    }
    // NotAuthorized / AliasExists / already-confirmed: fall through to sign-in.
  }

  try {
    const out = await cognito().send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: phone,
          PASSWORD: password,
          SECRET_HASH: secretHash(phone),
        },
      }),
    );
    if (!out.AuthenticationResult) {
      return NextResponse.json({ error: "Could not sign you in." }, { status: 500 });
    }
    const identity = identityFromTokens(out.AuthenticationResult);
    await ensureProfile(identity.profileId);
    const token = await mintDataToken(identity.profileId, {});
    return NextResponse.json({
      token,
      expiresIn: DATA_TOKEN_TTL_SECONDS,
      profileId: identity.profileId,
      email: null,
      cognitoUsername: identity.cognitoUsername,
      refreshToken: identity.refreshToken ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Could not sign you in." }, { status: 401 });
  }
}
