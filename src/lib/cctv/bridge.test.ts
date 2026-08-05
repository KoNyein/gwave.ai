/**
 * Camera Bridge publish tokens — what matters: a token only opens ITS path,
 * only before expiry, and verification never throws (the MediaMTX webhook
 * must fail closed).
 *
 * Run: node --experimental-strip-types --test src/lib/cctv/bridge.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import {
  BRIDGE_TOKEN_TTL_MS,
  mintBridgeToken,
  verifyBridgeToken,
} from "./bridge.ts";

const KEY = randomBytes(32).toString("base64");

function withKey<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.CAMERA_VENDOR_TOKEN_KEY_V1;
  if (value === undefined) delete process.env.CAMERA_VENDOR_TOKEN_KEY_V1;
  else process.env.CAMERA_VENDOR_TOKEN_KEY_V1 = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CAMERA_VENDOR_TOKEN_KEY_V1;
    else process.env.CAMERA_VENDOR_TOKEN_KEY_V1 = prev;
  }
}

test("mint → verify round-trips for the same path", () => {
  withKey(KEY, () => {
    const { token, expiresAtMs } = mintBridgeToken("bridge/cam_abc123");
    assert.ok(expiresAtMs > Date.now());
    assert.equal(verifyBridgeToken("bridge/cam_abc123", token), true);
  });
});

test("a token never opens a different path", () => {
  withKey(KEY, () => {
    const { token } = mintBridgeToken("bridge/cam_abc123");
    assert.equal(verifyBridgeToken("bridge/cam_other", token), false);
  });
});

test("expired tokens are rejected", () => {
  withKey(KEY, () => {
    const past = Date.now() - BRIDGE_TOKEN_TTL_MS - 1000;
    const { token } = mintBridgeToken("bridge/cam_abc123", past);
    assert.equal(verifyBridgeToken("bridge/cam_abc123", token), false);
  });
});

test("paths outside bridge/ are rejected even with a valid signature shape", () => {
  withKey(KEY, () => {
    const { token } = mintBridgeToken("live/hijack");
    assert.equal(verifyBridgeToken("live/hijack", token), false);
  });
});

test("tampered signatures and garbage tokens are rejected, never thrown", () => {
  withKey(KEY, () => {
    const { token } = mintBridgeToken("bridge/cam_abc123");
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    assert.equal(verifyBridgeToken("bridge/cam_abc123", flipped), false);
    for (const junk of ["", "v1", "v1.123.short", "v2.9.x", "…", token + "x"]) {
      assert.equal(verifyBridgeToken("bridge/cam_abc123", junk), false);
    }
  });
});

test("verification with the key unset fails closed instead of throwing", () => {
  const token = withKey(KEY, () => mintBridgeToken("bridge/cam_abc123").token);
  withKey(undefined, () => {
    assert.equal(verifyBridgeToken("bridge/cam_abc123", token), false);
  });
});

test("minting without the key throws loudly", () => {
  withKey(undefined, () => {
    assert.throws(() => mintBridgeToken("bridge/cam_abc123"));
  });
});
