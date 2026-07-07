import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";
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
 * Refreshes the Supabase auth session on every request and enforces
 * authentication for protected route groups.
 */
export async function updateSession(request: NextRequest) {
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
