import { NextResponse } from "next/server";
import { z } from "zod";

import { refreshCognitoTokens } from "@/lib/auth/cognito";
import { DATA_TOKEN_TTL_SECONDS, mintDataToken } from "@/lib/auth/tokens";
import { ensureProfile } from "@/lib/auth/ensure-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/auth/refresh — native silent re-auth. The app's data token
 * lives an hour; before it expires the app posts the stored Cognito refresh
 * token + username here to get a fresh data token. Cognito does not return a
 * new refresh token on this flow, so the app keeps the one it has. A 401
 * (revoked/expired refresh token) means the session is over and the app should
 * route back to sign-in.
 */
const schema = z.object({
  refreshToken: z.string().min(1),
  cognitoUsername: z.string().min(1),
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
    return NextResponse.json({ error: "Missing refresh token." }, { status: 400 });
  }

  const identity = await refreshCognitoTokens(
    parsed.data.refreshToken,
    parsed.data.cognitoUsername,
  );
  if (!identity) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  // Self-heal accounts created before profile provisioning existed.
  await ensureProfile(identity.profileId);
  const token = await mintDataToken(identity.profileId, {
    email: identity.email,
  });
  return NextResponse.json({
    token,
    expiresIn: DATA_TOKEN_TTL_SECONDS,
    profileId: identity.profileId,
    email: identity.email ?? null,
  });
}
