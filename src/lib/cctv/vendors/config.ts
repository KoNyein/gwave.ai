/**
 * Env accessors for the vendor-cloud camera framework. Kept dependency-free
 * (plain process.env reads, no zod/env.ts imports) so the vendor modules and
 * their node --test suites can run without the full Next.js env being set.
 * src/lib/env.ts re-exports these for app code.
 *
 * All of these are SERVER-ONLY values from /etc/gwave-web.env — none may ever
 * be NEXT_PUBLIC_*.
 */

/**
 * AES-256-GCM key for vendor token encryption at rest, base64-encoded 32
 * bytes. Generate with: openssl rand -base64 32
 * Returns null when unset; throws when set but not a 32-byte key (a wrong key
 * must fail loudly, not silently store garbage).
 */
export function getCameraVendorTokenKey(): Buffer | null {
  const raw = process.env.CAMERA_VENDOR_TOKEN_KEY_V1?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CAMERA_VENDOR_TOKEN_KEY_V1 must be base64 for exactly 32 bytes (openssl rand -base64 32)",
    );
  }
  return key;
}

/** Version of the active token key. Bump on rotation; old rows keep theirs. */
export const CAMERA_VENDOR_TOKEN_KEY_VERSION = 1;

/**
 * The fake connector may exist ONLY outside production: it exists so route
 * and Playwright tests never need real vendor credentials. In production it
 * is rejected regardless of the env var.
 */
export function isCctvVendorFakeEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CCTV_VENDOR_FAKE_ENABLED === "true";
}
