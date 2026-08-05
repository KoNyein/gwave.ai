/**
 * Camera Bridge — lets a phone on the camera's own WiFi relay the camera's
 * RTSP stream OUT to our MediaMTX (deploy/cctv-bridge/), which republishes it
 * as HLS. This is the path for router-less / CGNAT cameras where the server
 * can never reach the camera directly: the phone dials out instead.
 *
 * The publish credential is a stateless HMAC token minted here and verified
 * by the /api/cctv/bridge/auth webhook MediaMTX calls on every publish
 * attempt. It is signed with the existing CAMERA_VENDOR_TOKEN_KEY_V1 server
 * key (vendors/config.ts) — no new secret, nothing stored, expiry built in.
 *
 * Token wire format (the RTSP password the phone publishes with):
 *   v1.<expiresAtMs>.<base64url hmac-sha256(key, "gwave-bridge.v1.<path>.<exp>")>
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { getCameraVendorTokenKey } from "./vendors/config.ts";

/** RTSP username the phone publishes with; the token is the password. */
export const BRIDGE_PUBLISH_USER = "gwave-bridge";

/** MediaMTX path prefix — mediamtx.yml only accepts publishes under it. */
export const BRIDGE_PATH_PREFIX = "bridge/";

/** Tokens outlive one relay session; the phone refreshes on every reconnect. */
export const BRIDGE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Where the phone publishes to, e.g. "rtsp://gwave.cc:8554". Unset means the
 * bridge is not rolled out on this deployment — the session API answers 503.
 */
export function bridgePublishBase(): string | null {
  const raw = process.env.CCTV_BRIDGE_PUBLISH_BASE?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** Public HLS base fronting MediaMTX, e.g. "https://gwave.cc/hls". */
export function bridgeHlsBase(): string | null {
  const raw = process.env.CCTV_BRIDGE_HLS_BASE?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function isBridgeConfigured(): boolean {
  try {
    return Boolean(
      bridgePublishBase() && bridgeHlsBase() && getCameraVendorTokenKey(),
    );
  } catch {
    // A malformed key is "not configured", not a 500 — same fail-closed rule.
    return false;
  }
}

/** stream_id → MediaMTX path. Kept 1:1 so ops can match streams to rows. */
export function bridgePathForStream(streamId: string): string {
  return `${BRIDGE_PATH_PREFIX}${streamId}`;
}

function signature(path: string, expiresAtMs: number): Buffer {
  const key = getCameraVendorTokenKey();
  if (!key) {
    throw new Error(
      "CAMERA_VENDOR_TOKEN_KEY_V1 is not set — cannot mint bridge tokens",
    );
  }
  return createHmac("sha256", key)
    .update(`${BRIDGE_PUBLISH_USER}.v1.${path}.${expiresAtMs}`)
    .digest();
}

/** Mint the publish token for one MediaMTX path. */
export function mintBridgeToken(
  path: string,
  now: number = Date.now(),
): { token: string; expiresAtMs: number } {
  const expiresAtMs = now + BRIDGE_TOKEN_TTL_MS;
  const sig = signature(path, expiresAtMs).toString("base64url");
  return { token: `v1.${expiresAtMs}.${sig}`, expiresAtMs };
}

/**
 * Verify a publish token for a path. False on ANY defect — wrong shape,
 * wrong path, expired, bad signature, missing server key — never throws:
 * the auth webhook must fail closed, not 500 into MediaMTX's retry logic.
 */
export function verifyBridgeToken(
  path: string,
  token: string,
  now: number = Date.now(),
): boolean {
  const m = /^v1\.(\d{1,16})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return false;
  const expiresAtMs = Number(m[1]);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < now) return false;
  if (!path.startsWith(BRIDGE_PATH_PREFIX)) return false;
  let expected: Buffer;
  try {
    expected = signature(path, expiresAtMs);
  } catch {
    return false;
  }
  const got = Buffer.from(m[2] ?? "", "base64url");
  return got.length === expected.length && timingSafeEqual(got, expected);
}
