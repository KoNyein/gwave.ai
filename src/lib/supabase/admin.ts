import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleKey, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Privileged Supabase client using the service role key. This BYPASSES Row
 * Level Security and must ONLY be used in trusted server contexts (server
 * actions, route handlers). Never import this into a Client Component.
 */
export function createAdminClient() {
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
