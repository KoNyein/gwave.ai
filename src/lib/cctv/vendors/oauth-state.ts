/**
 * OAuth state + PKCE handling for vendor account linking
 * (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §11.2-11.3).
 *
 * The connect route stores this state in an HTTP-only cookie; the callback
 * validates it. The state binds FOUR things together — the random CSRF value,
 * the provider, the gwave user and the issue time — so a callback can only
 * complete the exact flow the same signed-in user started minutes earlier.
 *
 * Pure module (node:crypto only) so it unit-tests without Next.js.
 */

import { createHash, randomBytes } from "node:crypto";

/** Cookie lifetime; the callback also re-checks the embedded timestamp. */
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
export const OAUTH_STATE_COOKIE = "cam_vendor_oauth";

export interface VendorOauthState {
  /** Random CSRF value that must round-trip through the vendor. */
  state: string;
  provider: string;
  userId: string;
  /** PKCE verifier (kept server-side in the cookie, never sent to vendor). */
  verifier: string;
  issuedAt: number;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Start a flow: fresh state + PKCE pair, and the serialized cookie value. */
export function createOauthState(input: {
  provider: string;
  userId: string;
  now?: number;
}): { state: VendorOauthState; cookieValue: string; codeChallenge: string } {
  const state: VendorOauthState = {
    state: b64url(randomBytes(24)),
    provider: input.provider,
    userId: input.userId,
    verifier: b64url(randomBytes(32)),
    issuedAt: input.now ?? Date.now(),
  };
  return {
    state,
    cookieValue: b64url(Buffer.from(JSON.stringify(state), "utf8")),
    codeChallenge: pkceChallenge(state.verifier),
  };
}

/** S256 code challenge for a verifier. */
export function pkceChallenge(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

/** Parse a cookie value; null for anything malformed. */
export function parseOauthState(cookieValue: string | undefined | null): VendorOauthState | null {
  if (!cookieValue) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cookieValue, "base64url").toString("utf8"),
    ) as Partial<VendorOauthState>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.provider !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.verifier !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      parsed.state.length < 16
    ) {
      return null;
    }
    return parsed as VendorOauthState;
  } catch {
    return null;
  }
}

export type OauthStateFailure =
  | "missing"
  | "state_mismatch"
  | "provider_mismatch"
  | "user_mismatch"
  | "expired";

/**
 * Validate a callback against the stored state. Returns null when everything
 * matches, otherwise the first failure — the caller must treat EVERY failure
 * as a hard stop (no partial trust).
 */
export function validateOauthState(
  stored: VendorOauthState | null,
  actual: { state: string | null; provider: string; userId: string; now?: number },
): OauthStateFailure | null {
  if (!stored) return "missing";
  if (!actual.state || actual.state !== stored.state) return "state_mismatch";
  if (actual.provider !== stored.provider) return "provider_mismatch";
  if (actual.userId !== stored.userId) return "user_mismatch";
  const now = actual.now ?? Date.now();
  if (now - stored.issuedAt > OAUTH_STATE_MAX_AGE_MS) return "expired";
  return null;
}
