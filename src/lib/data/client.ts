"use client";

import { createClient as createPostgrestClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Browser-readable data token cookie (kept in sync with lib/auth/session.ts). */
const AT_COOKIE = "gw_at";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Data-API client for Client Components. Auth is handled by Cognito; this
 * client just carries the app's data token (the `gw_at` cookie) as its bearer,
 * via the `accessToken` hook so both REST and Realtime authenticate as the
 * signed-in user. Subject to RLS — never use for privileged operations.
 *
 * `@supabase/supabase-js` is a PostgREST client, and our AWS data plane
 * (PostgREST + Realtime over RDS, at NEXT_PUBLIC_DATA_API_URL) serves exactly
 * that wire protocol — the package stays, the hosted Supabase service is gone.
 */
export function createClient() {
  return createPostgrestClient<Database>(
    publicEnv.NEXT_PUBLIC_DATA_API_URL,
    publicEnv.NEXT_PUBLIC_DATA_API_KEY,
    {
      accessToken: async () => readCookie(AT_COOKIE),
    },
  );
}
