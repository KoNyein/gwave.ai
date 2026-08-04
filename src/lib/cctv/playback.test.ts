/**
 * Playback authorization + session mapping — the §11.5 rules as a matrix.
 * The one that MUST hold: a vendor-cloud camera never plays for anyone but
 * its owner unless the provider explicitly allowed public sharing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { canViewCamera, mapVendorSession, type PlayableCamera } from "./playback.ts";

const caps = (publicShare = false) => ({
  liveView: true,
  snapshot: false,
  ptz: false,
  audio: false,
  twoWayAudio: false,
  events: false,
  playback: false,
  publicSharingAllowed: publicShare,
});

function cam(over: Partial<PlayableCamera> = {}): PlayableCamera {
  return {
    id: "cam-1",
    owner_id: "owner",
    camera_type: "rtsp",
    stream_id: "cam_abc",
    share_token: "sharetoken123456",
    is_public: false,
    public_until: null,
    hls_url: null,
    vendor_provider: null,
    vendor_camera_id: null,
    vendor_connection_id: null,
    vendor_capabilities: null,
    ...over,
  };
}

test("a missing camera is not_found", () => {
  assert.equal(canViewCamera(null, { userId: "owner" }), "not_found");
});

test("the owner always views", () => {
  assert.equal(canViewCamera(cam(), { userId: "owner" }), null);
});

test("a stranger is denied on a private camera", () => {
  assert.equal(canViewCamera(cam(), { userId: "stranger" }), "private");
  assert.equal(canViewCamera(cam(), { userId: null }), "private");
});

test("a public camera views for anyone while the window is open", () => {
  const open = cam({ is_public: true });
  assert.equal(canViewCamera(open, { userId: null }), null);
  const timed = cam({
    is_public: true,
    public_until: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(canViewCamera(timed, { userId: "stranger" }), null);
});

test("an expired public window is private again", () => {
  const expired = cam({
    is_public: true,
    public_until: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(canViewCamera(expired, { userId: "stranger" }), "private");
});

test("the share token opens a private camera", () => {
  assert.equal(
    canViewCamera(cam(), { userId: null, shareToken: "sharetoken123456" }),
    null,
  );
  assert.equal(
    canViewCamera(cam(), { userId: null, shareToken: "wrong" }),
    "private",
  );
});

// ── ★ Vendor-cloud public sharing is provider-gated ─────────────────────────

test("a PUBLIC vendor camera still refuses non-owners by default", () => {
  const vendor = cam({
    camera_type: "vendor_cloud",
    is_public: true,
    vendor_provider: "fake",
    vendor_camera_id: "fake-cam-1",
    vendor_connection_id: "conn-1",
    vendor_capabilities: caps(false),
  });
  assert.equal(
    canViewCamera(vendor, { userId: "stranger" }),
    "vendor_public_share_disabled",
  );
  // Even the share token does not override the provider's terms.
  assert.equal(
    canViewCamera(vendor, { userId: null, shareToken: "sharetoken123456" }),
    "vendor_public_share_disabled",
  );
  // The owner is unaffected.
  assert.equal(canViewCamera(vendor, { userId: "owner" }), null);
});

test("vendor public sharing opens ONLY with the explicit capability", () => {
  const allowed = cam({
    camera_type: "vendor_cloud",
    is_public: true,
    vendor_capabilities: caps(true),
  });
  assert.equal(canViewCamera(allowed, { userId: "stranger" }), null);
});

test("a vendor camera without capabilities fails closed", () => {
  const broken = cam({
    camera_type: "vendor_cloud",
    is_public: true,
    vendor_capabilities: null,
  });
  assert.equal(
    canViewCamera(broken, { userId: "stranger" }),
    "vendor_public_share_disabled",
  );
});

// ── Session mapping ─────────────────────────────────────────────────────────

test("vendor sessions map onto the unified union", () => {
  assert.deepEqual(
    mapVendorSession("fake", { kind: "hls", url: "https://x.test/a.m3u8", expiresAt: "soon" }),
    { kind: "hls", url: "https://x.test/a.m3u8", expiresAt: "soon" },
  );
  assert.deepEqual(
    mapVendorSession("fake", { kind: "media_server", streamId: "vc_1" }),
    { kind: "embedded_media", streamId: "vc_1" },
  );
  assert.deepEqual(
    mapVendorSession("fake", { kind: "webrtc", provider: "fake", config: { a: 1 } }),
    { kind: "vendor_webrtc", provider: "fake", config: { a: 1 }, expiresAt: undefined },
  );
  assert.deepEqual(
    mapVendorSession("fake", {
      kind: "unsupported",
      reason: "no_cloud_live",
      gatewayRecommended: true,
    }),
    { kind: "unavailable", reason: "no_cloud_live", gatewayRecommended: true },
  );
});
