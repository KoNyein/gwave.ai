import "server-only";

import { createClient as createPostgrestClient } from "@supabase/supabase-js";

import { mintServiceToken } from "@/lib/auth/tokens";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Privileged data client. Carries a minted `service_role` token (the RDS
 * service_role has BYPASSRLS), so it bypasses Row Level Security — this is the
 * AWS-native replacement for the old hosted service-role key. Must ONLY be used
 * in trusted server contexts (server actions, route handlers, webhooks). Never
 * import into a Client Component. The token is minted lazily per request via the
 * accessToken hook, so this stays synchronous for its call sites.
 *
 * `@supabase/supabase-js` is a PostgREST client, and our AWS data plane
 * (PostgREST + Realtime over RDS, at NEXT_PUBLIC_DATA_API_URL) serves exactly
 * that wire protocol — the package stays, the hosted Supabase service is gone.
 */
export function createAdminClient() {
  return createPostgrestClient<Database>(
    publicEnv.NEXT_PUBLIC_DATA_API_URL,
    publicEnv.NEXT_PUBLIC_DATA_API_KEY,
    {
      accessToken: async () => mintServiceToken(),
    },
  );
}
