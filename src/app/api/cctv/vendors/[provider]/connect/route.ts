import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_MS,
  createOauthState,
} from "@/lib/cctv/vendors/oauth-state";
import { getEnabledCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import { isVendorCloudEnabled } from "@/lib/db/cctv-vendors";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cctv/vendors/[provider]/connect — start account linking
 * (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §11.2).
 *
 * Stores state + PKCE verifier in an HTTP-only cookie bound to the current
 * user and provider, then redirects to the connector's authorization URL.
 * The connector builds that URL from ITS configured base — this route never
 * redirects to anything a client supplied.
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ provider: string }> },
) {
  const params = await props.params;
  if (!(await isVendorCloudEnabled())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const connector = getEnabledCameraVendorConnector(params.provider);
  if (!connector) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      `${publicEnv.NEXT_PUBLIC_SITE_URL}/login?redirectTo=${encodeURIComponent("/cameras")}`,
    );
  }

  const { state, cookieValue, codeChallenge } = createOauthState({
    provider: connector.id,
    userId: user.id,
  });
  const redirectUri = `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/cctv/vendors/${connector.id}/callback`;
  const authUrl = await connector.buildAuthorizationUrl({
    state: state.state,
    redirectUri,
    codeChallenge,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Scoped to the vendor routes — no other request ever carries it.
    path: "/api/cctv/vendors",
    maxAge: Math.floor(OAUTH_STATE_MAX_AGE_MS / 1000),
  });
  return res;
}
