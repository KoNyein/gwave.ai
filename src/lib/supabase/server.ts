import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getCognitoAccessToken } from "@/lib/cognito-session";
import { isCognitoEnabled, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the anon key with the authenticated user's session — RLS still applies.
 *
 * Two modes:
 * - Cognito (third-party auth): attach the Cognito access token via the
 *   `accessToken` option. Supabase validates it against the registered Cognito
 *   issuer, so auth.uid() = the token's `sub` and every RLS policy keeps working.
 *   No Supabase auth cookies are involved.
 * - Supabase Auth (default): the cookie-based @supabase/ssr client, unchanged.
 */
export async function createClient() {
  if (isCognitoEnabled()) {
    const token = await getCognitoAccessToken();
    return createSupabaseClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        accessToken: async () => token ?? "",
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
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
