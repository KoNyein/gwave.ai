import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleKey, publicEnv } from "@/lib/env";
import { mintServiceToken } from "@/lib/supabase/mint-token";
import type { Database } from "@/types/database";

/**
 * Privileged Supabase client using the service role. This BYPASSES Row Level
 * Security and must ONLY be used in trusted server contexts (server actions,
 * route handlers). Never import this into a Client Component.
 *
 * Self-hosted PostgREST can't validate the opaque `sb_secret_...` service-role
 * key, so when SUPABASE_JWT_SECRET is configured we hand it a minted
 * `service_role` JWT instead (verified via the oct key in PostgREST's JWKS) —
 * otherwise privileged writes silently fall back to the anon role and RLS
 * rejects them. Falls back to the raw key on Supabase Cloud.
 */
export function createAdminClient() {
  const serviceToken = mintServiceToken();
  if (serviceToken) {
    return createSupabaseClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        accessToken: async () => serviceToken,
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }

  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
