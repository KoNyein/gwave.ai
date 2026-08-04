import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { safeErrorCode } from "@/lib/cctv/vendors/errors";
import {
  OAUTH_STATE_COOKIE,
  parseOauthState,
  validateOauthState,
} from "@/lib/cctv/vendors/oauth-state";
import { getEnabledCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import { isVendorCloudEnabled, saveVendorConnection } from "@/lib/db/cctv-vendors";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cctv/vendors/[provider]/callback — the vendor redirects here
 * after the user grants (or denies) access (§11.3).
 *
 * Every validation failure is a hard stop that redirects back with an error
 * marker and clears the state cookie so it cannot be replayed. `connected=1`
 * is only ever emitted AFTER the database writes succeed.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ provider: string }> },
) {
  const params = await props.params;

  const done = (result: string) => {
    const res = NextResponse.redirect(
      `${publicEnv.NEXT_PUBLIC_SITE_URL}/cameras/vendors/${encodeURIComponent(params.provider)}?connected=${result}`,
    );
    res.cookies.set(OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/cctv/vendors",
      maxAge: 0,
    });
    return res;
  };

  if (!(await isVendorCloudEnabled())) return done("0");
  const connector = getEnabledCameraVendorConnector(params.provider);
  if (!connector) return done("0");

  const user = await getCurrentUser();
  if (!user) return done("0");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = parseOauthState(
    request.headers
      .get("cookie")
      ?.match(new RegExp(`(?:^|; )${OAUTH_STATE_COOKIE}=([^;]+)`))?.[1],
  );
  const failure = validateOauthState(stored, {
    state,
    provider: connector.id,
    userId: user.id,
  });
  if (failure || !code || !stored) return done("0");

  try {
    const tokens = await connector.exchangeAuthorizationCode({
      code,
      redirectUri: `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/cctv/vendors/${connector.id}/callback`,
      codeVerifier: stored.verifier,
    });
    let label: string | undefined;
    try {
      label = (await connector.getAccount(tokens)).label;
    } catch {
      // A missing account label is cosmetic — the connection still works.
    }
    // Throws on failure — a redirect with connected=1 while no row exists is
    // exactly the false success the task document forbids.
    await saveVendorConnection({
      userId: user.id,
      provider: connector.id,
      tokens,
      accountLabel: label,
    });
    return done("1");
  } catch (e) {
    return done(`0&reason=${safeErrorCode(e)}`);
  }
}
