import { createClient as createPostgrestClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { AT_COOKIE } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Data-API client for Server Components, Server Actions and Route Handlers.
 * The app authenticates against Cognito and mints its own data token (stored in
 * the `gw_at` cookie). We attach that token as the bearer, so PostgREST/Realtime
 * see `sub = profiles.id` and every RLS policy resolves correctly. There is no
 * GoTrue session and no cookie writes.
 *
 * `@supabase/supabase-js` is a PostgREST client, and our AWS data plane
 * (PostgREST + Realtime over RDS, at NEXT_PUBLIC_DATA_API_URL) serves exactly
 * that wire protocol — the package stays, the hosted Supabase service is gone.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AT_COOKIE)?.value;

  return createPostgrestClient<Database>(
    publicEnv.NEXT_PUBLIC_DATA_API_URL,
    publicEnv.NEXT_PUBLIC_DATA_API_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {},
    },
  );
}
