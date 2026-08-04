/**
 * Deterministic fake vendor for tests and local development
 * (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §8.7).
 *
 * Exists so route tests and the Playwright flow never need real vendor
 * credentials. Enabled only by CCTV_VENDOR_FAKE_ENABLED=true outside
 * production; in production isEnabled() is false no matter what
 * (config.isCctvVendorFakeEnabled pins that).
 *
 * Behaviours it can simulate, all deterministic:
 *   * a two-camera account (one online with live view, one offline)
 *   * a third camera whose cloud cannot serve live video (gateway fallback)
 *   * token expiry (access token "fake-expired" behaves as expired)
 *   * refresh (issues a new token pair with a fixed lifetime)
 *   * revocation (code "revoked" fails the exchange)
 */

import { VendorError } from "./errors.ts";
import type {
  CameraVendorCapabilities,
  CameraVendorConnector,
  CameraVendorTokens,
  VendorCameraCandidate,
} from "./types.ts";
import { isCctvVendorFakeEnabled } from "./config.ts";

const ACCESS_LIFETIME_MS = 60 * 60 * 1000; // 1h, like a typical vendor token

const caps = (over: Partial<CameraVendorCapabilities>): CameraVendorCapabilities => ({
  liveView: false,
  snapshot: false,
  ptz: false,
  audio: false,
  twoWayAudio: false,
  events: false,
  playback: false,
  publicSharingAllowed: false,
  ...over,
});

/** The fixed camera fleet on the fake account. */
const FLEET: VendorCameraCandidate[] = [
  {
    provider: "fake",
    vendorCameraId: "fake-cam-1",
    name: "Front Door",
    model: "FK-100",
    serialNumberMasked: "••••0001",
    online: true,
    capabilities: caps({ liveView: true, snapshot: true, audio: true }),
    safeMetadata: { firmware: "1.0.0" },
  },
  {
    provider: "fake",
    vendorCameraId: "fake-cam-2",
    name: "Warehouse",
    model: "FK-200",
    serialNumberMasked: "••••0002",
    online: false,
    capabilities: caps({ liveView: true, ptz: true }),
  },
  {
    provider: "fake",
    vendorCameraId: "fake-cam-nolive",
    name: "Old Doorbell",
    model: "FK-DB",
    serialNumberMasked: "••••0003",
    online: true,
    // Cloud account sees it, but its cloud offers no third-party live view.
    capabilities: caps({ snapshot: true, events: true }),
  },
];

function assertLive(tokens: CameraVendorTokens): void {
  if (tokens.accessToken === "fake-expired") {
    throw new VendorError("auth_expired");
  }
  if (!tokens.accessToken.startsWith("fake-access-")) {
    throw new VendorError("auth_revoked");
  }
}

export const fakeConnector: CameraVendorConnector = {
  id: "fake",
  label: "Fake Vendor (dev)",

  isEnabled: () => isCctvVendorFakeEnabled(),

  async buildAuthorizationUrl({ state, redirectUri }) {
    // No real cloud: "authorization" is the callback itself with a fixed code.
    const url = new URL(redirectUri);
    url.searchParams.set("code", "fake-code");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeAuthorizationCode({ code }) {
    if (code === "revoked") throw new VendorError("auth_revoked");
    if (code !== "fake-code") throw new VendorError("invalid_response");
    return {
      accessToken: "fake-access-1",
      refreshToken: "fake-refresh-1",
      expiresAt: new Date(Date.now() + ACCESS_LIFETIME_MS),
      scope: ["cameras.read", "live.view"],
      providerAccountId: "fake-account",
    };
  },

  async refreshTokens(tokens) {
    if (tokens.refreshToken !== "fake-refresh-1") {
      throw new VendorError("auth_revoked");
    }
    return {
      accessToken: "fake-access-2",
      refreshToken: "fake-refresh-1",
      expiresAt: new Date(Date.now() + ACCESS_LIFETIME_MS),
      scope: tokens.scope,
      providerAccountId: "fake-account",
    };
  },

  async revoke() {
    // Nothing to do — the fake cloud holds no state.
  },

  async getAccount(tokens) {
    assertLive(tokens);
    return { providerAccountId: "fake-account", label: "dev@fake.example" };
  },

  async listCameras(tokens) {
    assertLive(tokens);
    return FLEET.map((c) => ({ ...c, capabilities: { ...c.capabilities } }));
  },

  async createPlaybackSession({ tokens, vendorCameraId }) {
    assertLive(tokens);
    const cam = FLEET.find((c) => c.vendorCameraId === vendorCameraId);
    if (!cam) throw new VendorError("not_found");
    if (!cam.capabilities.liveView) {
      return {
        kind: "unsupported",
        reason: "cloud_live_view_unavailable",
        gatewayRecommended: true,
      };
    }
    if (!cam.online) throw new VendorError("camera_offline");
    return {
      kind: "hls",
      // .test TLD is reserved for exactly this — never resolvable in prod.
      url: `https://media.fake-vendor.test/live/${vendorCameraId}/index.m3u8?session=fake`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  },

  async getSnapshot({ tokens, vendorCameraId }) {
    assertLive(tokens);
    const cam = FLEET.find((c) => c.vendorCameraId === vendorCameraId);
    if (!cam) throw new VendorError("not_found");
    if (!cam.capabilities.snapshot) throw new VendorError("unsupported");
    // A 1x1 transparent PNG — enough for tests to assert content flows.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    );
    return { contentType: "image/png", bytes: new Uint8Array(png) };
  },
};
