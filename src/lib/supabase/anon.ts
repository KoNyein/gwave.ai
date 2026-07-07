import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cookie-less anon client for PUBLIC data only (knowledge base, wellness).
 * Because it never touches cookies() it is safe to use inside
 * unstable_cache/ISR scopes where request APIs are unavailable. RLS applies
 * with the anon role, so it can only ever read what anonymous visitors can.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
