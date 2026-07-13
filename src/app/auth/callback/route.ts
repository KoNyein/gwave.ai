import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / email confirmation callback. Exchanges the auth code for a session
 * then routes the user to onboarding (new users) or their feed.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // `next` is attacker-reachable (it rides in the OAuth redirect). Only a plain
  // relative path may through — "//evil.com" is a protocol-relative URL and
  // would otherwise walk straight out of our origin.
  const requested = searchParams.get("next") ?? "/feed";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/feed";

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

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
