import { NextResponse } from "next/server";

import { getCognitoSessionUser } from "@/lib/cognito-session";
import { isCognitoEnabled } from "@/lib/env";
import { mintSupabaseToken } from "@/lib/supabase/mint-token";

export const dynamic = "force-dynamic";

/**
 * Hands the browser a Supabase-native token for its own Realtime/PostgREST
 * connections under Cognito third-party auth.
 *
 * The browser can't sign one itself (SUPABASE_JWT_SECRET is server-only), and
 * the raw Cognito access token is an RS256 JWT the self-hosted Realtime/PostgREST
 * reject ("alg Header Parameter value not allowed"). So mint a short-lived HS256
 * token here — signed with the same secret those services trust — and let the
 * browser client attach it. Returns { token: null } on Supabase Cloud or when
 * signed out.
 */
export async function GET() {
  if (!isCognitoEnabled()) {
    return NextResponse.json({ token: null });
  }
  const user = await getCognitoSessionUser();
  const token = user ? mintSupabaseToken(user.id) : null;
  return NextResponse.json(
    { token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
