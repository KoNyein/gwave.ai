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

/**
 * Amazon Cognito configuration for the auth migration (see docs/COGNITO_SETUP.md).
 * Server-only: the client secret must never reach the browser.
 *
 * Returns null until every required value is present, which is the switch that
 * keeps the app on Supabase Auth. Nothing reads Cognito until an operator sets
 * these on the server, so shipping this code changes no behaviour on its own.
 */
export type CognitoConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
  clientSecret: string;
  /** Hosted UI base, e.g. https://gwave-auth.auth.ap-southeast-1.amazoncognito.com */
  domain: string;
  /** OIDC issuer Supabase trusts: https://cognito-idp.<region>.amazonaws.com/<poolId> */
  issuer: string;
};

export function getCognitoConfig(): CognitoConfig | null {
  const region = process.env.COGNITO_REGION?.trim();
  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.COGNITO_CLIENT_ID?.trim();
  const clientSecret = process.env.COGNITO_CLIENT_SECRET?.trim();
  const domain = process.env.COGNITO_DOMAIN?.trim().replace(/\/$/, "");
  if (!region || !userPoolId || !clientId || !clientSecret || !domain) {
    return null;
  }
  return {
    region,
    userPoolId,
    clientId,
    clientSecret,
    domain,
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  };
}

/** True when Cognito is fully configured; the app then prefers it for login. */
export function isCognitoEnabled(): boolean {
  return getCognitoConfig() !== null;
}
