import "server-only";

import crypto from "node:crypto";

/**
 * Mint a Supabase-compatible JWT for a Cognito-authenticated user.
 *
 * Background: this deployment uses a self-hosted Supabase (PostgREST) rather
 * than Supabase Cloud. PostgREST validates a request's JWT against
 * SUPABASE_JWT_SECRET and reads two claims from it — `role` (which Postgres
 * role to run as) and `sub` (what auth.uid() returns). Cognito's own access
 * token is signed with Cognito's keys and carries no `role`, so PostgREST
 * treats the request as the anonymous role and every RLS `to authenticated`
 * insert/update is refused (e.g. "Could not send SOS", "Could not create
 * channel"). Supabase Cloud's third-party-auth feature papers over this, but a
 * bare self-hosted PostgREST does not.
 *
 * The fix is to hand PostgREST a token it natively understands: we re-sign a
 * short-lived HS256 JWT with the Supabase secret, carrying the verified
 * Cognito `sub` and role "authenticated" — exactly the shape GoTrue issues.
 * auth.uid() then equals the Cognito sub (matching the ids stored on every
 * row) and RLS keeps working unchanged.
 *
 * Returns null when SUPABASE_JWT_SECRET is not configured, so the caller can
 * fall back to the previous behaviour (passing the raw Cognito token). Uses the
 * Node crypto module — this runs only in Server Components / Actions / Route
 * Handlers (never the Edge middleware), so no external JWT dependency is needed.
 *
 * NOTE (this deployment): PostgREST here validates against a JWKS file that
 * ships only asymmetric EC/ES256 keys, so it would reject a plain HS256 token.
 * We add one symmetric "oct" key (whose `k` is base64url of this same secret's
 * UTF-8 bytes) to that JWKS so this token verifies — see
 * deploy/postgrest-add-hs256-key.sh. On Supabase Cloud or a PostgREST whose
 * PGRST_JWT_SECRET is the raw secret string, no such step is needed.
 */
function mintToken(claims: Record<string, unknown>): string | null {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iat: now,
    // Short-lived; a fresh token is minted on every server request.
    exp: now + 60 * 60,
    ...claims,
  };

  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

export function mintSupabaseToken(sub: string): string | null {
  if (!sub) return null;
  return mintToken({ sub, role: "authenticated", aud: "authenticated" });
}

/**
 * Mint a `service_role` token for the privileged admin client. Self-hosted
 * PostgREST validates JWTs against SUPABASE_JWT_SECRET (via the oct key we
 * added to its JWKS), but the service-role *key* is an opaque `sb_secret_...`
 * string it can't verify — so the admin client would silently drop to the anon
 * role and every RLS-bypassing write ("new row violates row-level security
 * policy for table …", profile provisioning, live-stream create, webhooks)
 * would fail. Signing a real service_role JWT restores the bypass. Returns null
 * when SUPABASE_JWT_SECRET isn't set (Supabase Cloud path uses the raw key).
 */
export function mintServiceToken(): string | null {
  return mintToken({ role: "service_role", aud: "service_role" });
}
