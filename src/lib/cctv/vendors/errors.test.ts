/**
 * Error normalization + secret redaction — redactSecrets is the last line of
 * defence before anything reaches a log line, so it must catch every shape a
 * vendor secret realistically takes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  VendorError,
  isVendorError,
  redactSecrets,
  safeErrorCode,
} from "./errors.ts";

test("transient flags: network and rate_limited are retryable", () => {
  assert.equal(new VendorError("network").transient, true);
  assert.equal(new VendorError("rate_limited").transient, true);
  assert.equal(new VendorError("auth_expired").transient, false);
  assert.equal(new VendorError("not_implemented").transient, false);
});

test("safeErrorCode collapses unknown errors to network", () => {
  assert.equal(safeErrorCode(new VendorError("auth_revoked")), "auth_revoked");
  assert.equal(safeErrorCode(new Error("ECONNRESET at https://x")), "network");
  assert.equal(safeErrorCode("weird"), "network");
  assert.ok(isVendorError(new VendorError("unsupported")));
  assert.ok(!isVendorError(new Error("x")));
});

test("redacts rtsp credentials", () => {
  const out = redactSecrets("failed rtsp://admin:hunter2@10.0.0.5:554/stream1");
  assert.ok(!out.includes("hunter2"));
  assert.ok(!out.includes("admin:"));
  assert.ok(out.includes("rtsp://***@"));
});

test("redacts bearer tokens", () => {
  const out = redactSecrets("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret");
  assert.ok(!out.includes("eyJhbGci"));
});

test("redacts URL query values (signed playback urls)", () => {
  const out = redactSecrets(
    "GET https://cloud.vendor.example/live.m3u8?expires=173&token=abc123def",
  );
  assert.ok(!out.includes("abc123def"));
  assert.ok(!out.includes("173"));
  // The path itself stays readable for debugging.
  assert.ok(out.includes("live.m3u8"));
});

test("redacts long opaque token-shaped runs", () => {
  const secret = "sk_live_" + "a1b2c3d4".repeat(6);
  const out = redactSecrets(`refresh failed for ${secret} after retry`);
  assert.ok(!out.includes("a1b2c3d4".repeat(6)));
  assert.ok(out.includes("refresh failed"));
});
