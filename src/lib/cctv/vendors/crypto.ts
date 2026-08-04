/**
 * AES-256-GCM encryption for vendor tokens at rest
 * (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §7.3).
 *
 * The camera_vendor_secrets table stores only ciphertext + nonce + auth tag +
 * key version; the key itself lives in /etc/gwave-web.env
 * (CAMERA_VENDOR_TOKEN_KEY_V1). A database leak therefore does not leak
 * usable vendor tokens, and the GCM auth tag makes ciphertext tampering
 * detectable instead of silently decrypting to garbage.
 *
 * Both tokens of a row share one nonce+tag pair (they are sealed together as
 * one JSON document) — a fresh random nonce per WRITE, never reused with the
 * same key, which is the property GCM actually requires.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import {
  CAMERA_VENDOR_TOKEN_KEY_VERSION,
  getCameraVendorTokenKey,
} from "./config.ts";

export interface SealedVendorTokens {
  accessTokenCiphertext: string;
  /** Null when the provider issued no refresh token. */
  refreshTokenCiphertext: string | null;
  nonce: string;
  authTag: string;
  keyVersion: number;
}

export interface PlainVendorTokens {
  accessToken: string;
  refreshToken?: string;
}

/** Key lookup by version — rotation adds a case, old rows stay readable. */
function keyForVersion(version: number): Buffer {
  if (version === 1) {
    const key = getCameraVendorTokenKey();
    if (!key) {
      throw new Error(
        "CAMERA_VENDOR_TOKEN_KEY_V1 is not set — cannot handle vendor tokens",
      );
    }
    return key;
  }
  throw new Error(`Unknown camera vendor token key version ${version}`);
}

/**
 * Encrypt a token pair for storage. The two tokens are sealed as one GCM
 * message ({"a":…,"r":…}) so a single auth tag covers both — an attacker
 * with DB write access cannot mix a stale refresh token into a fresh row.
 * The whole sealed JSON goes in access_token_ciphertext;
 * refresh_token_ciphertext is a marker column (null = the provider issued no
 * refresh token) so queries can tell the cases apart without decrypting.
 */
export function sealVendorTokens(plain: PlainVendorTokens): SealedVendorTokens {
  if (!plain.accessToken) throw new Error("sealVendorTokens: empty accessToken");
  const key = keyForVersion(CAMERA_VENDOR_TOKEN_KEY_VERSION);
  const nonce = randomBytes(12); // GCM standard 96-bit nonce
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const message = JSON.stringify({
    a: plain.accessToken,
    r: plain.refreshToken ?? null,
  });
  const ciphertext = Buffer.concat([
    cipher.update(message, "utf8"),
    cipher.final(),
  ]);
  return {
    accessTokenCiphertext: ciphertext.toString("base64"),
    refreshTokenCiphertext: plain.refreshToken ? "sealed-with-access" : null,
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: CAMERA_VENDOR_TOKEN_KEY_VERSION,
  };
}

/**
 * Decrypt a stored token pair. Throws on a bad key, tampered ciphertext,
 * tampered nonce or tampered tag — GCM authentication failure must never be
 * swallowed into an empty token.
 */
export function openVendorTokens(sealed: SealedVendorTokens): PlainVendorTokens {
  const key = keyForVersion(sealed.keyVersion);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(sealed.nonce, "base64"),
  );
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.accessTokenCiphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext) as { a: string; r: string | null };
  if (typeof parsed.a !== "string" || parsed.a.length === 0) {
    throw new Error("openVendorTokens: decrypted payload missing access token");
  }
  return {
    accessToken: parsed.a,
    refreshToken: parsed.r ?? undefined,
  };
}
