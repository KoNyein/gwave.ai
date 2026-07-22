import { z } from "zod";

const publicSchema = z.object({
  /**
   * The gwave data plane: our self-hosted PostgREST + Realtime in front of RDS,
   * served at https://gwave.cc/sb. This is NOT Supabase — gwave moved off the
   * hosted service on 2026-07-17 (data on RDS, storage on S3/CloudFront, auth on
   * Cognito). The `@supabase/supabase-js` package is still the client for it
   * because it speaks PostgREST, which is exactly what the AWS side serves.
   *
   * DATA_API_KEY is the anon-role HS256 JWT. PostgREST ignores `apikey` and
   * reads the bearer, but self-hosted Realtime decodes this value as a JWT to
   * authorise the socket — so it must stay a real JWT, not a placeholder.
   */
  NEXT_PUBLIC_DATA_API_URL: z.string().url(),
  NEXT_PUBLIC_DATA_API_KEY: z.string().min(1),
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
   * CloudFront domain for media (e.g. https://xxxx.cloudfront.net). Set in
   * production, where all media lives on S3 behind CloudFront. Unset falls back
   * to the legacy object-storage path on the data API, which is only reachable
   * on pre-2026-07-17 installs — production has this set.
   */
  NEXT_PUBLIC_S3_CDN: z.string().url().optional(),
  /**
   * Agora Live provider. NEXT_PUBLIC_AGORA_APP_ID is the (public) App ID the
   * client joins with; NEXT_PUBLIC_LIVE_PROVIDER = "agora" makes new broadcasts
   * use Agora instead of LiveKit (feature flag — default keeps LiveKit).
   * NEXT_PUBLIC_AGORA_RECORDING_BASE is the public base URL a saved replay is
   * served from (falls back to the media CDN when unset).
   */
  NEXT_PUBLIC_AGORA_APP_ID: z.string().optional(),
  NEXT_PUBLIC_LIVE_PROVIDER: z
    .enum(["livekit", "agora", "ivs"])
    .default("livekit"),
  NEXT_PUBLIC_AGORA_RECORDING_BASE: z.string().url().optional(),
  /** Public base URL IVS Real-Time composite recordings play back from. */
  NEXT_PUBLIC_IVS_RECORDING_BASE: z.string().url().optional(),
  /** Messenger call media transport: legacy WebRTC mesh, or Amazon Chime. */
  NEXT_PUBLIC_CALL_PROVIDER: z.enum(["mesh", "chime"]).default("mesh"),
});

/**
 * Public environment variables, validated at module load.
 * These are safe to expose to the browser bundle.
 *
 * NEXT_PUBLIC_DATA_API_URL / _KEY were renamed from NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY (the backend is not Supabase — see the schema
 * above). Both spellings are accepted, new name first, so a deploy carrying only
 * the old build args keeps working. The old names are still baked into the
 * production image and /etc/gwave-web.env; drop this fallback only once every
 * builder and env file has been confirmed to set the new names.
 *
 * These must stay LITERAL `process.env.NEXT_PUBLIC_*` member expressions —
 * Next.js inlines public env vars into the client bundle by static analysis, so
 * a computed lookup (process.env[name]) would silently evaluate to undefined in
 * the browser.
 */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_DATA_API_URL:
    process.env.NEXT_PUBLIC_DATA_API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_DATA_API_KEY:
    process.env.NEXT_PUBLIC_DATA_API_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
  NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  NEXT_PUBLIC_S3_CDN: process.env.NEXT_PUBLIC_S3_CDN,
  NEXT_PUBLIC_AGORA_APP_ID: process.env.NEXT_PUBLIC_AGORA_APP_ID,
  NEXT_PUBLIC_LIVE_PROVIDER: process.env.NEXT_PUBLIC_LIVE_PROVIDER,
  NEXT_PUBLIC_AGORA_RECORDING_BASE: process.env.NEXT_PUBLIC_AGORA_RECORDING_BASE,
  NEXT_PUBLIC_IVS_RECORDING_BASE: process.env.NEXT_PUBLIC_IVS_RECORDING_BASE,
  NEXT_PUBLIC_CALL_PROVIDER: process.env.NEXT_PUBLIC_CALL_PROVIDER,
});

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
/**
 * Fitbit Web API OAuth (https://dev.fitbit.com) — the free health-data provider.
 * Server-only: the client secret must never reach the browser.
 *
 * Returns null until both are set, which keeps the whole health-data feature
 * dormant — the app behaves exactly as before until an operator configures it
 * (mirrors the other optional integrations).
 */
export type FitbitConfig = {
  clientId: string;
  clientSecret: string;
};

export function getFitbitConfig(): FitbitConfig | null {
  const clientId = process.env.FITBIT_CLIENT_ID?.trim();
  const clientSecret = process.env.FITBIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** True when the Fitbit health integration is fully configured. */
export function isFitbitEnabled(): boolean {
  return getFitbitConfig() !== null;
}

/**
 * Google Fit OAuth (https://console.cloud.google.com). Server-only. NOTE: the
 * Google Fit REST API is deprecated by Google — kept as an optional secondary
 * provider. A dedicated OAuth client (separate from Maps/One Tap) with fitness
 * scopes is required.
 */
export type GoogleFitConfig = {
  clientId: string;
  clientSecret: string;
};

export function getGoogleFitConfig(): GoogleFitConfig | null {
  const clientId = process.env.GOOGLE_FIT_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_FIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleFitEnabled(): boolean {
  return getGoogleFitConfig() !== null;
}

/** True when ANY health provider is configured (drives the connect UI). */
export function isHealthEnabled(): boolean {
  return isFitbitEnabled() || isGoogleFitEnabled();
}

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
