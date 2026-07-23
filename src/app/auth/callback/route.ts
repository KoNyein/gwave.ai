import { randomUUID } from "node:crypto";

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { decodeJwt } from "jose";

import { authEnv } from "@/lib/env";
import { cognito } from "@/lib/auth/cognito";
import { setSession } from "@/lib/auth/session";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createClient } from "@/lib/data/server";

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
 * The authoritative profile id from the Cognito user store. The ID token's
 * `custom:profile_id` claim can be missing or stale for federated (Google)
 * users — e.g. the attribute was back-filled after the token was issued — so
 * an absent claim must never be trusted on its own.
 */
async function storedProfileId(
  username: string,
): Promise<string | null | undefined> {
  if (!username) return null;
  try {
    const out = await cognito().send(
      new AdminGetUserCommand({
        UserPoolId: authEnv.cognito.userPoolId,
        Username: username,
      }),
    );
    return (
      out.UserAttributes?.find((a) => a.Name === "custom:profile_id")?.Value ??
      null
    );
  } catch {
    // The lookup itself failed (IAM permissions, throttling, network) — that
    // is "unknown", NOT "absent". Callers must never overwrite the stored
    // attribute based on this, or a transient failure permanently unlinks
    // the account from its profile.
    return undefined;
  }
}

/**
 * The profile id of another account with this (Google-verified) email, so a
 * first Google sign-in links to it instead of creating a duplicate profile.
 */
async function profileIdForEmail(
  email: string | undefined,
  selfUsername: string,
): Promise<string | null | undefined> {
  if (!email) return null;
  try {
    const out = await cognito().send(
      new ListUsersCommand({
        UserPoolId: authEnv.cognito.userPoolId,
        Filter: `email = "${email.replace(/["\\]/g, "")}"`,
        Limit: 30,
      }),
    );
    for (const u of out.Users ?? []) {
      if (u.Username === selfUsername) continue;
      const pid = u.Attributes?.find(
        (a) => a.Name === "custom:profile_id",
      )?.Value;
      if (pid) return pid;
    }
  } catch {
    // Lookup failed — unknown, not "no match" (see storedProfileId).
    return undefined;
  }
  return null;
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

  // Native app flow. The Android app can't register its gwave:// scheme as a
  // Cognito callback (only this https URL is whitelisted), so it borrows this
  // callback with state=mobile. Hand the code straight to the app via its
  // gwave://auth deep link WITHOUT exchanging it here — the app exchanges it
  // at /api/mobile/auth/google (with this URL as redirect_uri). Served as a
  // tiny page (auto-redirect + button) because some browsers only follow
  // custom-scheme intents from a page, not a bare 302.
  if (requested === "mobile" && code) {
    const deepLink = `gwave://auth?code=${encodeURIComponent(code)}`;
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opening Gwave…</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;
       justify-content:center;min-height:100vh;margin:0;background:#EEF5E7;color:#12160E;text-align:center;padding:24px}
  a.btn{margin-top:18px;background:#3B6D11;color:#fff;text-decoration:none;font-weight:700;
        padding:14px 28px;border-radius:14px;font-size:16px}
  p{color:#5B6650;font-size:14px;max-width:320px}
</style></head><body>
<h2>Gwave app သို့ ပြန်သွားနေသည်…</h2>
<p>အလိုအလျောက် မပွင့်ရင် အောက်က ခလုတ်ကို နှိပ်ပါ။</p>
<a class="btn" href="${deepLink}">Open Gwave app</a>
<script>location.replace(${JSON.stringify(deepLink)});</script>
</body></html>`;
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

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

        // Account linking (state=link): a signed-in user asked to attach this
        // Google identity to their EXISTING account. The signed gw_link cookie
        // (set by startGoogleLink) names the target profile; re-point the
        // Google-federated Cognito user's custom:profile_id at it so every
        // future Google sign-in — web and app — resolves to that account.
        if (requested === "link") {
          const store = await cookies();
          const intent = await verifyDataToken(store.get("gw_link")?.value);
          store.delete("gw_link");
          if (!intent?.sub) {
            return NextResponse.redirect(`${origin}/settings?link=expired`);
          }
          try {
            await cognito().send(
              new AdminUpdateUserAttributesCommand({
                UserPoolId: authEnv.cognito.userPoolId,
                Username: cognitoUsername,
                UserAttributes: [
                  { Name: "custom:profile_id", Value: intent.sub },
                ],
              }),
            );
          } catch {
            return NextResponse.redirect(`${origin}/settings?link=failed`);
          }
          // Stay signed into the linked (existing) account, now backed by the
          // Google user's refresh token.
          await setSession({
            profileId: intent.sub,
            email: intent.email ?? email,
            cognitoUsername,
            accessToken: tokens.access_token,
            idToken: tokens.id_token,
            refreshToken: tokens.refresh_token,
          });
          return NextResponse.redirect(`${origin}/settings?link=google_ok`);
        }

        // A first-time Google user has no custom:profile_id claim yet — but
        // the claim can also simply be stale/absent from the token, so check
        // the user store, then other accounts on the same email, and only then
        // mint a fresh profile (back-filled so later logins are stable).
        const claimed = claims["custom:profile_id"];
        let profileId: string;
        if (typeof claimed === "string" && claimed) {
          profileId = claimed;
        } else {
          const stored = await storedProfileId(cognitoUsername);
          let linked: string | null | undefined;
          if (typeof stored === "string") {
            linked = stored;
          } else if (stored === null) {
            linked = await profileIdForEmail(email, cognitoUsername);
          } else {
            // User-store read failed — we know nothing; don't make a
            // persistent decision from it.
            linked = undefined;
          }
          profileId = typeof linked === "string" ? linked : randomUUID();
          // Back-fill ONLY when the user store definitively had no value.
          // Writing over an attribute we merely failed to READ was the bug
          // that kept re-pointing accounts at fresh empty profiles.
          if (stored === null && linked !== undefined) {
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
        const db = await createClient();
        const { data: profile } = await db
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
