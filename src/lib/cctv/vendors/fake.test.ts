/**
 * Fake connector behaviour — it is the contract every real connector must
 * follow (deterministic fleet, normalized errors, no raw RTSP anywhere), and
 * the substrate for the PR-2 route tests and the Playwright flow.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { fakeConnector } from "./fake.ts";
import { VendorError } from "./errors.ts";
import type { CameraVendorTokens } from "./types.ts";

async function login(): Promise<CameraVendorTokens> {
  return fakeConnector.exchangeAuthorizationCode({
    code: "fake-code",
    redirectUri: "https://gwave.cc/api/cctv/vendors/fake/callback",
  });
}

test("the authorization url round-trips state through the redirect uri", async () => {
  const url = new URL(
    await fakeConnector.buildAuthorizationUrl({
      state: "st4te",
      redirectUri: "https://gwave.cc/api/cctv/vendors/fake/callback",
    }),
  );
  assert.equal(url.searchParams.get("state"), "st4te");
  assert.equal(url.searchParams.get("code"), "fake-code");
});

test("code exchange yields tokens with an expiry and account id", async () => {
  const tokens = await login();
  assert.ok(tokens.accessToken.startsWith("fake-access-"));
  assert.equal(tokens.providerAccountId, "fake-account");
  assert.ok(tokens.expiresAt && tokens.expiresAt.getTime() > Date.now());
});

test("a revoked authorization code fails as auth_revoked", async () => {
  await assert.rejects(
    fakeConnector.exchangeAuthorizationCode({
      code: "revoked",
      redirectUri: "https://x.test/cb",
    }),
    (e: unknown) => e instanceof VendorError && e.code === "auth_revoked",
  );
});

test("listCameras returns the deterministic fleet", async () => {
  const tokens = await login();
  const cameras = await fakeConnector.listCameras(tokens);
  assert.equal(cameras.length, 3);
  assert.deepEqual(
    cameras.map((c) => c.vendorCameraId),
    ["fake-cam-1", "fake-cam-2", "fake-cam-nolive"],
  );
  // Serials are pre-masked; nothing looks like a raw serial number.
  for (const c of cameras) {
    assert.ok(c.serialNumberMasked?.startsWith("••••"));
  }
});

test("an expired access token is refused with auth_expired", async () => {
  await assert.rejects(
    fakeConnector.listCameras({ accessToken: "fake-expired" }),
    (e: unknown) => e instanceof VendorError && e.code === "auth_expired",
  );
});

test("refresh issues a new access token for the known refresh token", async () => {
  const tokens = await login();
  const next = await fakeConnector.refreshTokens(tokens);
  assert.notEqual(next.accessToken, tokens.accessToken);
  assert.ok(next.expiresAt && next.expiresAt.getTime() > Date.now());
});

test("refresh with an unknown refresh token is auth_revoked", async () => {
  await assert.rejects(
    fakeConnector.refreshTokens({ accessToken: "x", refreshToken: "stolen" }),
    (e: unknown) => e instanceof VendorError && e.code === "auth_revoked",
  );
});

test("playback for the online camera is a short-lived HLS session", async () => {
  const tokens = await login();
  const session = await fakeConnector.createPlaybackSession({
    tokens,
    vendorCameraId: "fake-cam-1",
  });
  assert.equal(session.kind, "hls");
  if (session.kind === "hls") {
    assert.ok(session.url.startsWith("https://"));
    assert.ok(!session.url.startsWith("rtsp:"), "no raw RTSP to the browser");
    assert.ok(session.expiresAt, "sessions must expire");
  }
});

test("playback for the offline camera fails as camera_offline", async () => {
  const tokens = await login();
  await assert.rejects(
    fakeConnector.createPlaybackSession({ tokens, vendorCameraId: "fake-cam-2" }),
    (e: unknown) => e instanceof VendorError && e.code === "camera_offline",
  );
});

test("a camera without cloud live view recommends the gateway", async () => {
  const tokens = await login();
  const session = await fakeConnector.createPlaybackSession({
    tokens,
    vendorCameraId: "fake-cam-nolive",
  });
  assert.equal(session.kind, "unsupported");
  if (session.kind === "unsupported") {
    assert.equal(session.gatewayRecommended, true);
  }
});

test("an unknown camera id is not_found", async () => {
  const tokens = await login();
  await assert.rejects(
    fakeConnector.createPlaybackSession({ tokens, vendorCameraId: "nope" }),
    (e: unknown) => e instanceof VendorError && e.code === "not_found",
  );
});

test("snapshot returns image bytes for the snapshot-capable camera", async () => {
  const tokens = await login();
  const snap = await fakeConnector.getSnapshot!({
    tokens,
    vendorCameraId: "fake-cam-1",
  });
  assert.equal(snap.contentType, "image/png");
  assert.ok(snap.bytes.length > 0);
});

test("public sharing is disallowed on every fake camera", async () => {
  // The default posture: providers must EXPLICITLY declare public sharing.
  const tokens = await login();
  for (const cam of await fakeConnector.listCameras(tokens)) {
    assert.equal(cam.capabilities.publicSharingAllowed, false);
  }
});
