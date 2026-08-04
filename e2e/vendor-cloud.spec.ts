import { expect, test } from "@playwright/test";

/**
 * Vendor-cloud camera guards. The CI environment has no real database, so
 * the cctv_vendor_cloud flag read fails and the feature must FAIL CLOSED —
 * which is itself the behaviour under test here: no provider leaks, no
 * route half-works without the flag.
 *
 * The full connect→import→disconnect flow against the fake provider runs in
 * local development (CCTV_VENDOR_FAKE_ENABLED=true + flag on + a signed-in
 * user); its logic is covered by the vendors unit suites.
 */

test("vendors list fails closed to an empty provider list", async ({ request }) => {
  const response = await request.get("/api/cctv/vendors");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.providers).toEqual([]);
  expect(body.connections).toEqual([]);
});

test("connect 404s while the feature flag is unavailable", async ({ request }) => {
  const response = await request.get("/api/cctv/vendors/fake/connect", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("an unknown provider's connect 404s", async ({ request }) => {
  const response = await request.get("/api/cctv/vendors/not-a-vendor/connect", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("camera discovery and import demand auth (or flag) — never 200", async ({
  request,
}) => {
  const cameras = await request.get("/api/cctv/vendors/fake/cameras");
  expect([401, 404]).toContain(cameras.status());
  const importRes = await request.post("/api/cctv/vendors/fake/import", {
    data: { connectionId: "00000000-0000-0000-0000-000000000000", cameraIds: ["x"] },
  });
  expect([401, 404]).toContain(importRes.status());
});

test("stream sessions are never cached and fail closed", async ({ request }) => {
  const response = await request.post(
    "/api/cctv/cameras/00000000-0000-0000-0000-000000000000/stream",
    { data: {} },
  );
  // No database → the camera cannot resolve; only a hard failure code is
  // acceptable, and never a cacheable response.
  expect([404, 429, 500, 502]).toContain(response.status());
  if (response.headers()["cache-control"]) {
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("vendor snapshot and ptz demand auth (or flag)", async ({ request }) => {
  const snap = await request.get(
    "/api/cctv/cameras/00000000-0000-0000-0000-000000000000/snapshot",
  );
  expect([401, 404, 429]).toContain(snap.status());
  const ptz = await request.post(
    "/api/cctv/cameras/00000000-0000-0000-0000-000000000000/ptz",
    { data: { action: "stop" } },
  );
  expect([401, 404, 429]).toContain(ptz.status());
});

test("the vendor import page is auth/flag gated", async ({ request }) => {
  // Flag unavailable → 404; with a database this would bounce to /login.
  const response = await request.get("/cameras/vendors/fake", {
    maxRedirects: 0,
  });
  expect([404, 307]).toContain(response.status());
});
