import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { AT_COOKIE } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase *data* client for Server Components, Server Actions and Route
 * Handlers. Auth is no longer Supabase's job — the app authenticates against
 * Cognito and mints its own data token (stored in the `gw_at` cookie). We attach
 * that token as the bearer, so PostgREST/Realtime see `sub = profiles.id` and
 * every RLS policy resolves correctly. No Supabase session, no cookie writes.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AT_COOKIE)?.value;

  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {},
    },
  );
}
