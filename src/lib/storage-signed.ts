import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleKey, publicEnv } from "@/lib/env";

/**
 * Signed URLs for objects in a private storage bucket.
 *
 * Storage lives on the Supabase Cloud project (Caddy proxies /sb/* there). Under
 * Cognito the request-scoped Supabase client signs a token Cloud storage rejects
 * ("signature verification failed"), so the request-scoped client can't mint a
 * working signed URL. The Cloud service key, however, is accepted — and it can
 * sign for any object — so generate signed URLs with it here. Callers are already
 * admin- or owner-gated at the page level, so bypassing storage RLS is fine.
 */
let cloud: ReturnType<typeof createSupabaseClient> | null = null;

function cloudStorage() {
  if (!cloud) {
    cloud = createSupabaseClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      getServiceRoleKey(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cloud;
}

/** A time-limited signed URL for a private-bucket object, or null on failure. */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await cloudStorage()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
