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

// Cache the minted Supabase token so every Realtime/PostgREST call doesn't
// round-trip to /api/sb-token. Tokens live 60 min; refresh a little early.
let sbToken: { value: string; expMs: number } | null = null;

/**
 * Fetch a short-lived Supabase-native token for the browser's own
 * Realtime/PostgREST connections. The raw Cognito access token is RS256 and the
 * self-hosted Realtime/PostgREST reject it ("alg Header Parameter value not
 * allowed"); this HS256 token is signed with the secret those services trust.
 */
async function getSbToken(): Promise<string> {
  const now = Date.now();
  if (sbToken && sbToken.expMs > now + 60_000) return sbToken.value;
  try {
    const res = await fetch("/api/sb-token", { credentials: "include" });
    const data = (await res.json()) as { token: string | null };
    if (data.token) {
      sbToken = { value: data.token, expMs: now + 50 * 60_000 };
      return data.token;
    }
  } catch {
    /* offline / signed out — fall through to empty */
  }
  return "";
}

/**
 * Supabase client for use in Client Components. Uses the anon key and is subject
 * to Row Level Security — never use this for privileged operations.
 *
 * Under Cognito third-party auth, attach a minted Supabase token (not the raw
 * Cognito access token, which Realtime/PostgREST can't verify) so browser
 * Realtime/Storage/RLS see the same identity as the server. Otherwise fall back
 * to the cookie-based Supabase Auth client, unchanged.
 */
export function createClient() {
  if (readCookie(COGNITO_AT_COOKIE)) {
    return createSupabaseClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        accessToken: async () => getSbToken(),
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
