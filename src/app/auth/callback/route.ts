import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { decodeJwt } from "jose";

import { authEnv } from "@/lib/env";
import { cognito } from "@/lib/auth/cognito";
import { setSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The origin as the *browser* sees it (behind the reverse proxy the request URL
 * carries the container's own address).
 */
async function publicOrigin(fallback: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return fallback;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Cognito Hosted UI callback (Google federation). Exchanges the authorization
 * code for tokens at Cognito's /oauth2/token, derives the user's profiles.id
 * (creating and back-filling custom:profile_id for a brand-new Google user),
 * mints our session, and routes to onboarding (new) or the feed.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const origin = await publicOrigin(requestUrl.origin);
  const code = searchParams.get("code");

  // `state` carries the intended destination; only a plain relative path is
  // allowed so it can't be turned into an open redirect.
  const requested = searchParams.get("state") ?? "/feed";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/feed";

  const providerError = searchParams.get("error");
  if (providerError) {
    const reason =
      searchParams.get("error_description") ?? providerError.replace(/_/g, " ");
    const login = new URL(`${origin}/login`);
    login.searchParams.set("error", "oauth");
    login.searchParams.set("reason", reason);
    return NextResponse.redirect(login);
  }

  if (code) {
    try {
      const { domain, clientId, clientSecret } = authEnv.cognito;
      const redirectUri = `${origin}/auth/callback`;
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
          code,
          redirect_uri: redirectUri,
        }),
      });
      if (res.ok) {
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
        let profileId: string;
        if (typeof claimed === "string" && claimed) {
          profileId = claimed;
        } else {
          profileId = randomUUID();
          await cognito()
            .send(
              new AdminUpdateUserAttributesCommand({
                UserPoolId: authEnv.cognito.userPoolId,
                Username: cognitoUsername,
                UserAttributes: [
                  { Name: "custom:profile_id", Value: profileId },
                ],
              }),
            )
            .catch(() => {});
        }

        await setSession({
          profileId,
          email,
          cognitoUsername,
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          refreshToken: tokens.refresh_token,
        });

        // New users (no username on their profile) go to onboarding.
        const supabase = await createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", profileId)
          .maybeSingle();
        const destination = profile?.username ? next : "/onboarding";
        return NextResponse.redirect(`${origin}${destination}`);
      }
    } catch {
      // fall through to the error redirect
    }
  }

  const failed = new URL(`${origin}/login`);
  failed.searchParams.set("error", "auth");
  return NextResponse.redirect(failed);
}
