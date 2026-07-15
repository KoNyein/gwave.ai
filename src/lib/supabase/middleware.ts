import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getCognitoConfig, isCognitoEnabled, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PROTECTED_PREFIXES = [
  "/feed",
  "/onboarding",
  "/tools",
  "/farm",
  "/home",
  "/pos",
  "/admin",
  "/dev",
];

const AUTH_ROUTES = ["/login", "/register"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the auth session on every request and enforces authentication for
 * protected route groups. Branches on the configured auth provider.
 */
export async function updateSession(request: NextRequest) {
  if (isCognitoEnabled()) {
    return updateCognitoSession(request);
  }
  return updateSupabaseSession(request);
}

/**
 * Cognito (third-party auth) session upkeep. Runs in the Edge runtime, so it
 * avoids Buffer and the server-only cognito helpers: the refresh call is done
 * inline with fetch + btoa. The access-token cookie (gw_at) and the id-token
 * cookie (gw_it) share the token's short lifetime; when they've expired but the
 * long-lived refresh cookie (gw_rt) remains, mint a fresh pair.
 */
async function updateCognitoSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const hasAccess = Boolean(request.cookies.get("gw_at"));
  const refresh = request.cookies.get("gw_rt")?.value;
  let hasSession = hasAccess || Boolean(request.cookies.get("gw_it"));

  if (!hasAccess && refresh) {
    const tokens = await refreshCognitoTokens(refresh);
    if (tokens) {
      const secure = process.env.NODE_ENV === "production";
      request.cookies.set("gw_at", tokens.access_token);
      request.cookies.set("gw_it", tokens.id_token);
      response = NextResponse.next({ request });
      response.cookies.set("gw_at", tokens.access_token, {
        path: "/",
        sameSite: "lax",
        secure,
        httpOnly: false,
        maxAge: tokens.expires_in,
      });
      response.cookies.set("gw_it", tokens.id_token, {
        path: "/",
        sameSite: "lax",
        secure,
        httpOnly: true,
        maxAge: tokens.expires_in,
      });
      hasSession = true;
    } else {
      hasSession = false;
    }
  }

  if (!hasSession && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

type RefreshResult = {
  access_token: string;
  id_token: string;
  expires_in: number;
};

/** Edge-safe Cognito refresh-token exchange (no Buffer / no server-only deps). */
async function refreshCognitoTokens(
  refreshToken: string,
): Promise<RefreshResult | null> {
  const cfg = getCognitoConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.domain}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${cfg.clientId}:${cfg.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: cfg.clientId,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const t = (await res.json()) as RefreshResult;
    if (!t.access_token || !t.id_token) return null;
    return t;
  } catch {
    return null;
  }
}

/**
 * Refreshes the Supabase auth session on every request and enforces
 * authentication for protected route groups.
 */
async function updateSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
