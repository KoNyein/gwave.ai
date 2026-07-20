import { NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/config — the public data-plane config for the native app.
 *
 * The app reads/writes PostgREST directly (same as the browser data client), so
 * it needs the exact same `NEXT_PUBLIC_SUPABASE_URL` + anon key the web uses.
 * Instead of maintaining a second copy as build-time secrets — which can drift
 * and cause "No suitable key" JWT errors when they point at the wrong PostgREST —
 * the app fetches them here at startup, guaranteeing it always talks to the same
 * data plane the web does. Both values are already public (shipped in the browser
 * bundle), so exposing them here changes nothing.
 *
 * `cognitoDomain` + `cognitoClientId` drive the native Google sign-in (the app
 * builds the Cognito Hosted UI authorize URL from them). Both are public — they
 * appear in every OAuth redirect URL. Empty when Google sign-in isn't configured,
 * in which case the app simply hides the Google button.
 */
export async function GET() {
  return NextResponse.json({
    supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cognitoDomain: process.env.COGNITO_DOMAIN ?? "",
    cognitoClientId: process.env.COGNITO_CLIENT_ID ?? "",
  });
}
