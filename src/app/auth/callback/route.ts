import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { decodeIdToken, exchangeCodeForTokens } from "@/lib/cognito";
import { consumeOAuthState, setCognitoSession } from "@/lib/cognito-session";
import { isCognitoEnabled } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * The origin as the *browser* sees it. Behind the reverse proxy the request URL
 * carries the container's own address, so building redirects from it sent people
 * to https://0.0.0.0:3000 — a dead end. The forwarded headers are what carry the
 * real host, and they're what the auth server actions already trust.
 */
async function publicOrigin(fallback: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return fallback;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * OAuth / email confirmation callback. Exchanges the auth code for a session
 * then routes the user to onboarding (new users) or their feed.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const origin = await publicOrigin(requestUrl.origin);
  const code = searchParams.get("code");

  // `next` is attacker-reachable (it rides in the OAuth redirect). Only a plain
  // relative path may through — "//evil.com" is a protocol-relative URL and
  // would otherwise walk straight out of our origin.
  const requested = searchParams.get("next") ?? "/feed";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/feed";

  // Google hands its own failures back here (consent screen still in testing,
  // user cancelled, admin policy…). Carry the reason to the login page instead
  // of swallowing it — a blank "auth" error tells nobody anything.
  const providerError = searchParams.get("error");
  if (providerError) {
    const reason =
      searchParams.get("error_description") ?? providerError.replace(/_/g, " ");
    const login = new URL(`${origin}/login`);
    login.searchParams.set("error", "oauth");
    login.searchParams.set("reason", reason);
    return NextResponse.redirect(login);
  }

  // Cognito (third-party auth): exchange the code for Cognito tokens, store them
  // in the session cookies, and provision the profile row on first sign-in.
  if (isCognitoEnabled()) {
    const dest = await consumeOAuthState(searchParams.get("state"));
    if (code && dest) {
      try {
        const tokens = await exchangeCodeForTokens(
          code,
          `${origin}/auth/callback`,
        );
        await setCognitoSession(tokens);
        const claims = decodeIdToken(tokens.id_token);

        // Service role: create the profile if this is the user's first sign-in
        // (there's no auth.users trigger under Cognito), never overwriting an
        // existing row.
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from("profiles")
          .select("username")
          .eq("id", claims.sub)
          .maybeSingle();
        if (!profile) {
          await admin.from("profiles").insert({
            id: claims.sub,
            full_name: claims.name ?? null,
            avatar_url: claims.picture ?? null,
          });
        }

        const destination = profile?.username ? dest : "/onboarding";
        return NextResponse.redirect(`${origin}${destination}`);
      } catch {
        // Fall through to the generic failure redirect below.
      }
    }
    const failed = new URL(`${origin}/login`);
    failed.searchParams.set("error", "auth");
    return NextResponse.redirect(failed);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        const destination = profile?.username ? next : "/onboarding";
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  const failed = new URL(`${origin}/login`);
  failed.searchParams.set("error", "auth");
  return NextResponse.redirect(failed);
}
