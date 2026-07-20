import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { AdminUpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider";
import { decodeJwt } from "jose";
import { z } from "zod";

import { authEnv } from "@/lib/env";
import { cognito } from "@/lib/auth/cognito";
import { DATA_TOKEN_TTL_SECONDS, mintDataToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/auth/google — native Google sign-in.
 *
 * The web signs in with Google through Cognito's Hosted UI and finishes at
 * `/auth/callback`, which exchanges the authorization code for tokens and sets
 * the `gw_at` cookie. Native apps can't share that cookie jar, so this is the
 * JSON twin: the app opens the same Hosted UI (redirecting to its own
 * `gwave://auth` deep link), catches the `code`, and posts it here. We run the
 * identical `/oauth2/token` exchange, mint the same data token, and hand it back
 * in the body — mirroring `/auth/callback` exactly, including back-filling
 * `custom:profile_id` for a brand-new Google user so their profile id is stable.
 */
const schema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().min(1),
});

export async function POST(request: Request) {
  if (!process.env.COGNITO_DOMAIN) {
    return NextResponse.json(
      { error: "Google sign-in is not enabled." },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing authorization code." },
      { status: 400 },
    );
  }

  try {
    const { domain, clientId, clientSecret, userPoolId } = authEnv.cognito;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${domain}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code: parsed.data.code,
        redirect_uri: parsed.data.redirectUri,
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Google sign-in failed." }, { status: 401 });
    }

    const tokens = (await res.json()) as {
      id_token: string;
      access_token: string;
      refresh_token?: string;
    };
    const claims = decodeJwt(tokens.id_token);
    const cognitoUsername =
      (claims["cognito:username"] as string) ?? (claims.sub as string) ?? "";
    const email = typeof claims.email === "string" ? claims.email : undefined;

    // A first-time Google user has no custom:profile_id yet — mint one and
    // back-fill it on the Cognito user so subsequent logins are stable.
    const claimed = claims["custom:profile_id"];
    const isNewUser = !(typeof claimed === "string" && claimed);
    let profileId: string;
    if (typeof claimed === "string" && claimed) {
      profileId = claimed;
    } else {
      profileId = randomUUID();
      await cognito()
        .send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: userPoolId,
            Username: cognitoUsername,
            UserAttributes: [{ Name: "custom:profile_id", Value: profileId }],
          }),
        )
        .catch(() => {});
    }

    const token = await mintDataToken(profileId, { email });
    return NextResponse.json({
      token,
      expiresIn: DATA_TOKEN_TTL_SECONDS,
      profileId,
      email: email ?? null,
      cognitoUsername,
      refreshToken: tokens.refresh_token ?? null,
      isNewUser,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
