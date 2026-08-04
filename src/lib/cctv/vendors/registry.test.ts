/**
 * Registry gating — the security-relevant behaviours are that the fake
 * provider can never exist in production and that an unconfigured provider
 * is invisible rather than half-working.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  getCameraVendorConnector,
  getEnabledCameraVendorConnector,
  getEnabledCameraVendorConnectors,
} from "./registry.ts";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("no providers are enabled by default", () => {
  withEnv({ CCTV_VENDOR_FAKE_ENABLED: undefined }, () => {
    assert.deepEqual(getEnabledCameraVendorConnectors(), []);
  });
});

test("the fake provider appears only when explicitly enabled", () => {
  withEnv({ CCTV_VENDOR_FAKE_ENABLED: "true" }, () => {
    const enabled = getEnabledCameraVendorConnectors().map((c) => c.id);
    assert.deepEqual(enabled, ["fake"]);
  });
});

test("the fake provider is rejected in production regardless of env", () => {
  // node:test runs with NODE_ENV=test locally; simulate a production build.
  withEnv(
    { CCTV_VENDOR_FAKE_ENABLED: "true", NODE_ENV: "production" },
    () => {
      assert.equal(getEnabledCameraVendorConnector("fake"), null);
      assert.deepEqual(getEnabledCameraVendorConnectors(), []);
    },
  );
});

test("hikvision resolves by id but is NOT enabled (stub)", () => {
  // Even a fully-set env must not enable the stub — IMPLEMENTED is false
  // until approved credentials + feasibility sign-off (PR 4).
  withEnv(
    {
      HIKVISION_CAMERA_ENABLED: "true",
      HIKVISION_CLIENT_ID: "id",
      HIKVISION_CLIENT_SECRET: "secret",
      HIKVISION_AUTH_BASE_URL: "https://auth.hik.example",
      HIKVISION_API_BASE_URL: "https://api.hik.example",
      HIKVISION_REDIRECT_URI: "https://gwave.cc/api/cctv/vendors/hikvision/callback",
    },
    () => {
      assert.ok(getCameraVendorConnector("hikvision"));
      assert.equal(getEnabledCameraVendorConnector("hikvision"), null);
    },
  );
});

test("an unknown provider id resolves to null", () => {
  assert.equal(getCameraVendorConnector("nest"), null);
  assert.equal(getEnabledCameraVendorConnector("nest"), null);
});
