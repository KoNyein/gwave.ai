/**
 * Typed errors + log redaction for vendor-cloud camera connectors.
 *
 * Every failure that crosses a route boundary must be a VendorError with a
 * SAFE code — raw vendor error bodies can carry tokens, signed URLs or account
 * identifiers, so they are never propagated verbatim. `redactSecrets` is the
 * last line of defence for anything that does get logged.
 */

export type VendorErrorCode =
  | "vendor_disabled"
  | "not_implemented"
  | "auth_expired"
  | "auth_revoked"
  | "rate_limited"
  | "network"
  | "invalid_response"
  | "camera_offline"
  | "unsupported"
  | "not_found";

export class VendorError extends Error {
  readonly code: VendorErrorCode;
  /** True when retrying later may succeed (network, rate limit). */
  readonly transient: boolean;

  constructor(code: VendorErrorCode, message?: string) {
    super(message ?? code);
    this.name = "VendorError";
    this.code = code;
    this.transient = code === "network" || code === "rate_limited";
  }
}

export function isVendorError(e: unknown): e is VendorError {
  return e instanceof VendorError;
}

/** The safe code for logging/metrics; unknown errors collapse to "network". */
export function safeErrorCode(e: unknown): VendorErrorCode {
  return isVendorError(e) ? e.code : "network";
}

/**
 * Strip secret-looking material from a string before it can reach a log:
 *   * URL query values (signed playback URLs put tokens there)
 *   * bearer tokens
 *   * long opaque token-like runs
 *   * rtsp:// credentials (user:pass@host)
 */
export function redactSecrets(text: string): string {
  return (
    text
      // rtsp://user:pass@host → rtsp://***@host
      .replace(/(rtsps?:\/\/)[^@/\s]+@/gi, "$1***@")
      // Authorization: Bearer xxx / access_token=xxx
      .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, "$1***")
      // every URL query value: ?a=1&token=xyz → ?a=***&token=***
      .replace(/([?&][a-z0-9_-]+=)[^&\s"']*/gi, "$1***")
      // long opaque secret-shaped runs (32+ token chars). `/` is excluded so
      // URL hosts/paths stay readable — their query values were already
      // redacted above; JWTs and base64ish tokens are still caught per
      // path-free segment.
      .replace(/[a-zA-Z0-9._~+-]{32,}/g, "***")
  );
}
