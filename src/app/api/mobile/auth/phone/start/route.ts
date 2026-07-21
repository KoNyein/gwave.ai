import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import {
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";

import { authEnv } from "@/lib/env";
import { cognito, identityFromTokens, secretHash } from "@/lib/auth/cognito";
import { DATA_TOKEN_TTL_SECONDS, mintDataToken } from "@/lib/auth/tokens";
import { derivePhonePassword, normalizePhone } from "@/lib/auth/phone";
import { checkAuthRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/auth/phone/start — begin phone sign-in.
 *
 * A new number is registered with Cognito, which texts a confirmation code; the
 * app then posts it to `/phone/verify`. A number that already exists is signed
 * in straight away (returns the data token) — or, if it never confirmed, has its
 * code resent. Phone auth uses a password derived from the number (see
 * lib/auth/phone), so it stays a pure OTP experience for the user.
 */
const schema = z.object({ phone: z.string().min(3) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your phone number." }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  if (!(await checkAuthRateLimit(`mobile-phone:${phone}`, 5))) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429 },
    );
  }

  const { clientId } = authEnv.cognito;
  const password = derivePhonePassword(phone);

  try {
    await cognito().send(
      new SignUpCommand({
        ClientId: clientId,
        Username: phone,
        Password: password,
        SecretHash: secretHash(phone),
        UserAttributes: [
          { Name: "phone_number", Value: phone },
          { Name: "custom:profile_id", Value: randomUUID() },
        ],
      }),
    );
    return NextResponse.json({ status: "code_sent", phone });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name !== "UsernameExistsException") {
      return NextResponse.json({ error: "Couldn't send the code." }, { status: 500 });
    }
  }

  // Existing number: try a direct sign-in; if it was never confirmed, resend a code.
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
    if (out.AuthenticationResult) {
      const identity = identityFromTokens(out.AuthenticationResult);
      const token = await mintDataToken(identity.profileId, {});
      return NextResponse.json({
        status: "signed_in",
        token,
        expiresIn: DATA_TOKEN_TTL_SECONDS,
        profileId: identity.profileId,
        email: null,
        cognitoUsername: identity.cognitoUsername,
        refreshToken: identity.refreshToken ?? null,
      });
    }
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "UserNotConfirmedException") {
      await cognito()
        .send(
          new ResendConfirmationCodeCommand({
            ClientId: clientId,
            Username: phone,
            SecretHash: secretHash(phone),
          }),
        )
        .catch(() => {});
      return NextResponse.json({ status: "code_sent", phone });
    }
  }

  return NextResponse.json({ error: "Couldn't sign you in." }, { status: 401 });
}
