"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const COGNITO_AT_COOKIE = "gw_at";

/** Read a browser cookie by name, or null. */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Supabase client for use in Client Components. Uses the anon key and is subject
 * to Row Level Security — never use this for privileged operations.
 *
 * When a Cognito access token cookie is present (third-party auth), attach it
 * via the `accessToken` option so browser Realtime/Storage/RLS see the same
 * identity as the server. Otherwise fall back to the cookie-based Supabase Auth
 * client, unchanged.
 */
export function createClient() {
  if (readCookie(COGNITO_AT_COOKIE)) {
    return createSupabaseClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        accessToken: async () => readCookie(COGNITO_AT_COOKIE) ?? "",
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
