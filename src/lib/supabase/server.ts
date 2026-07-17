import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  clearCognitoSession,
  getCognitoAccessToken,
  getCognitoSessionUser,
} from "@/lib/cognito-session";
import { isCognitoEnabled, publicEnv } from "@/lib/env";
import { mintSupabaseToken } from "@/lib/supabase/mint-token";
import type { Database } from "@/types/database";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the anon key with the authenticated user's session — RLS still applies.
 *
 * Two modes:
 * - Cognito (third-party auth): attach a session token via the `accessToken`
 *   option. When SUPABASE_JWT_SECRET is set we mint a Supabase-native token
 *   (role "authenticated", sub = the Cognito user) so a self-hosted PostgREST
 *   grants the authenticated role and auth.uid() works for writes; otherwise we
 *   fall back to the raw Cognito access token. Either way RLS keeps applying and
 *   no Supabase auth cookies are involved.
 * - Supabase Auth (default): the cookie-based @supabase/ssr client, unchanged.
 */
export async function createClient() {
  if (isCognitoEnabled()) {
    const sessionUser = await getCognitoSessionUser();
    const token =
      (sessionUser ? mintSupabaseToken(sessionUser.id) : null) ??
      (await getCognitoAccessToken()) ??
      "";
    const client = createSupabaseClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        accessToken: async () => token,
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    // With the `accessToken` option set, supabase-js replaces `client.auth`
    // with a Proxy that throws on ANY access ("accessing supabase.auth.getUser
    // is not possible"). Dozens of server actions and db helpers identify the
    // caller with `const { data: { user } } = await supabase.auth.getUser()`,
    // so under Cognito that Proxy crashes the render/action. Swap it for a tiny
    // auth shim backed by the verified Cognito session — the same identity the
    // minted token carries — so every existing call site keeps working without
    // touching ~65 files.
    const authedUser = sessionUser
      ? { id: sessionUser.id, email: sessionUser.email }
      : null;
    (client as unknown as { auth: unknown }).auth = {
      getUser: async () => ({ data: { user: authedUser }, error: null }),
      getSession: async () => ({
        data: { session: authedUser ? { user: authedUser } : null },
        error: null,
      }),
      // A couple of server actions call supabase.auth.signOut() to drop a stale
      // session (e.g. onboarding on a 23503 FK violation). Under Cognito that's
      // clearing the Cognito cookies, not a Supabase auth round-trip.
      signOut: async () => {
        await clearCognitoSession();
        return { error: null };
      },
    };
    return client;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component. This can
            // be ignored if middleware refreshes the session.
          }
        },
      },
    },
  );
}
