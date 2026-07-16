"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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
 * Supabase *data* client for Client Components. Auth is handled by Cognito; this
 * client just carries the app's data token (the `gw_at` cookie) as its bearer,
 * via the `accessToken` hook so both REST and Realtime authenticate as the
 * signed-in user. Subject to RLS — never use for privileged operations.
 */
export function createClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      accessToken: async () => readCookie(AT_COOKIE),
    },
  );
}
