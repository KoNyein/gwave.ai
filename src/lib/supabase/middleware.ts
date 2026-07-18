import { importJWK, jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware session check for the Cognito/JWT auth stack.
 *
 * Middleware runs on the Edge runtime, so it can only *verify* the data token
 * (jose is edge-safe) — it cannot reach Cognito or Node crypto to refresh it.
 * When the token has expired but a Cognito refresh token is present, it bounces
 * a protected page request through /api/auth/refresh (a Node route) which mints
 * a fresh token and returns the user to where they were going.
 */

const AT_COOKIE = "gw_at";
const RT_COOKIE = "gw_rt";
const ALG = "ES256";

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

let keyPromise: Promise<CryptoKey> | null = null;
function verifyKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const jwk = JSON.parse(process.env.APP_JWT_PUBLIC_JWK ?? "{}");
    keyPromise = importJWK(jwk, ALG) as Promise<CryptoKey>;
  }
  return keyPromise;
}

async function hasValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, await verifyKey(), {
      algorithms: [ALG],
      audience: "authenticated",
    });
    return true;
  } catch {
    return false;
  }
}

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AT_COOKIE)?.value;
  const authed = await hasValidToken(token);

  // Session expired but refreshable: send protected page GETs through the Node
  // refresh route, which re-mints the token and redirects back. This must run
  // even when the gw_at cookie is GONE entirely — it has maxAge 1h, so the
  // browser deletes it and `token` is undefined on the next visit; requiring
  // the cookie to still be present sent 30-day refresh-token holders to /login
  // every hour instead of silently refreshing.
  if (!authed && request.method === "GET" && isProtected(pathname)) {
    const canRefresh = Boolean(request.cookies.get(RT_COOKIE)?.value);
    if (canRefresh) {
      const url = request.nextUrl.clone();
      url.pathname = "/api/auth/refresh";
      url.search = "";
      url.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (authed && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
