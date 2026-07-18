import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { clearSession, refreshSession } from "@/lib/auth/session";

/**
 * Node-runtime session refresh. Edge middleware redirects here when the data
 * token has expired but a Cognito refresh token is present; we exchange it, set
 * a fresh data token, and send the user back to where they were headed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("next") ?? "/feed";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/feed";

  const store = await cookies();
  const session = await refreshSession(store, store);

  const origin = request.nextUrl.origin;
  if (!session) {
    // The refresh token is dead (revoked/expired). Clear the stale cookies so
    // middleware doesn't bounce every protected GET back through here — the
    // user goes straight to /login until they sign in again.
    await clearSession();
    const login = new URL("/login", origin);
    login.searchParams.set("redirectTo", next);
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(new URL(next, origin));
}
