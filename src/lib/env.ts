import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Google OAuth web client ID. Only needed for One Tap (the sign-in prompt
   * that logs a returning Google user straight in); the redirect-based
   * "Continue with Google" button works without it, since Supabase holds the
   * credentials. Unset simply means no One Tap.
   */
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  /**
   * CloudFront domain for media (e.g. https://xxxx.cloudfront.net). When set,
   * the app reads and writes media on S3 instead of Supabase Storage. Unset =
   * Supabase Storage (the default), so this flips the whole storage backend.
   */
  NEXT_PUBLIC_S3_CDN: z.string().url().optional(),
});

/**
 * Public environment variables, validated at module load.
 * These are safe to expose to the browser bundle.
 */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_S3_CDN: process.env.NEXT_PUBLIC_S3_CDN,
});

/**
 * Reads the Supabase service role key. Server-only — throws if called where the
 * variable is not present so it can never silently fall back to the client.
 */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This key must only be used on the server.",
    );
  }
  return key;
}
