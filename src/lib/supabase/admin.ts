import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { mintServiceToken } from "@/lib/auth/tokens";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Privileged data client. Carries a minted `service_role` token (the RDS
 * service_role has BYPASSRLS), so it bypasses Row Level Security exactly as
 * Supabase's service role key did. Must ONLY be used in trusted server contexts
 * (server actions, route handlers, webhooks). Never import into a Client
 * Component. The token is minted lazily per request via the accessToken hook, so
 * this stays synchronous for its call sites.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      accessToken: async () => mintServiceToken(),
    },
  );
}
