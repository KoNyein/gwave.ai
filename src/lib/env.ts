import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Google OAuth web client ID. Only needed for One Tap (the sign-in prompt
   * that logs a returning Google user straight in). Unset simply means no One Tap.
   */
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  /**
   * Cognito Hosted UI domain + app client id (both public — they appear in OAuth
   * redirect URLs). One Tap uses them to redirect into the Cognito Google flow.
   */
  NEXT_PUBLIC_COGNITO_DOMAIN: z.string().url().optional(),
  NEXT_PUBLIC_COGNITO_CLIENT_ID: z.string().optional(),
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
  NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
  NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
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

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (server-only auth configuration).`);
  }
  return value;
}

/**
 * Server-only auth configuration for the AWS-native auth stack (Cognito + our
 * own JWT signing). None of these are ever exposed to the browser bundle.
 *
 * The app authenticates users against Cognito, then mints its OWN short-lived
 * ES256 "data token" whose `sub` is the user's profiles.id — PostgREST and
 * Realtime trust our JWKS and `auth.uid()` reads that `sub`, so every RLS
 * policy keeps resolving to the right user. `APP_JWT_PRIVATE_KEY` is a
 * base64-encoded PKCS#8 PEM (base64 so it survives a single-line env file);
 * `APP_JWT_PUBLIC_JWK` is the matching public JWK (carries the `kid`).
 */
export const authEnv = {
  get jwtPrivateKeyPem(): string {
    return Buffer.from(required("APP_JWT_PRIVATE_KEY"), "base64").toString("utf8");
  },
  get jwtPublicJwk(): Record<string, unknown> {
    return JSON.parse(required("APP_JWT_PUBLIC_JWK"));
  },
  get cognito() {
    return {
      region: process.env.COGNITO_REGION ?? "ap-southeast-1",
      userPoolId: required("COGNITO_USER_POOL_ID"),
      clientId: required("COGNITO_CLIENT_ID"),
      clientSecret: required("COGNITO_CLIENT_SECRET"),
      /** Hosted UI domain, e.g. https://gwave-auth.auth.ap-southeast-1.amazoncognito.com */
      domain: required("COGNITO_DOMAIN"),
    };
  },
};
