/**
 * Shared shapes for vendor-cloud camera connectors
 * (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §8).
 *
 * Mirrors the health-provider pattern (src/lib/health/types.ts): each vendor
 * implements CameraVendorConnector, the registry maps an id to one, and a
 * provider that is not configured simply does not exist as far as the UI is
 * concerned.
 *
 * Everything here is transport-only data — no secrets are modelled beyond
 * CameraVendorTokens, which never leaves the server (encrypted at rest via
 * ./crypto.ts, service-role-only table).
 */

/**
 * Known provider ids. The database stores provider as validated text (not an
 * enum) so adding a provider is a registry change, not a migration.
 */
export type CameraVendorId =
  | "hikvision"
  | "dahua"
  | "reolink"
  | "amcrest"
  | "tapo"
  | "fake";

/** Normalized OAuth-style token set returned by a connector. Server-only. */
export interface CameraVendorTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
  providerAccountId?: string;
}

/**
 * Normalized per-camera feature flags. `publicSharingAllowed` defaults to
 * false and may only be true when the provider's terms explicitly allow
 * third-party public redistribution.
 */
export interface CameraVendorCapabilities {
  liveView: boolean;
  snapshot: boolean;
  ptz: boolean;
  audio: boolean;
  twoWayAudio: boolean;
  events: boolean;
  playback: boolean;
  publicSharingAllowed: boolean;
}

/** A camera discovered on the linked vendor account, before import. */
export interface VendorCameraCandidate {
  provider: CameraVendorId;
  vendorCameraId: string;
  name: string;
  model?: string;
  /** Masked (e.g. "••••1234") — raw serials never reach the UI or logs. */
  serialNumberMasked?: string;
  online: boolean | null;
  capabilities: CameraVendorCapabilities;
  /** Sanitized non-secret extras. Never credentials or stream URLs. */
  safeMetadata?: Record<string, unknown>;
}

/**
 * What the browser is allowed to receive for playback. A raw RTSP URL is
 * deliberately unrepresentable: the `media_server` kind carries only a
 * gwave-controlled stream id after the server registered the temporary
 * source with the existing media relay.
 */
export type VendorPlaybackSession =
  | {
      kind: "hls";
      url: string;
      expiresAt?: string;
    }
  | {
      kind: "webrtc";
      provider: CameraVendorId;
      config: Record<string, unknown>;
      expiresAt?: string;
    }
  | {
      kind: "media_server";
      streamId: string;
      expiresAt?: string;
    }
  | {
      kind: "unsupported";
      reason: string;
      gatewayRecommended: boolean;
    };

/** Normalized PTZ command dispatched through a connector. */
export interface CameraPtzCommand {
  action: "move" | "zoom" | "stop" | "preset";
  /** move: -1..1 per axis. */
  pan?: number;
  tilt?: number;
  /** zoom: -1..1 (out/in). */
  zoom?: number;
  presetId?: string;
}

/**
 * One vendor-cloud integration. Implementations live next to this file and
 * are registered in ./registry.ts. Every method that talks to the vendor must
 * validate the external response with Zod before returning.
 */
export interface CameraVendorConnector {
  readonly id: CameraVendorId;
  readonly label: string;

  /** Fully configured AND allowed in this environment. Drives the UI list. */
  isEnabled(): boolean;

  buildAuthorizationUrl(input: {
    state: string;
    redirectUri: string;
    codeChallenge?: string;
  }): Promise<string>;

  exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<CameraVendorTokens>;

  refreshTokens(tokens: CameraVendorTokens): Promise<CameraVendorTokens>;

  revoke(tokens: CameraVendorTokens): Promise<void>;

  getAccount(tokens: CameraVendorTokens): Promise<{
    providerAccountId?: string;
    label?: string;
  }>;

  listCameras(tokens: CameraVendorTokens): Promise<VendorCameraCandidate[]>;

  createPlaybackSession(input: {
    tokens: CameraVendorTokens;
    vendorCameraId: string;
  }): Promise<VendorPlaybackSession>;

  getSnapshot?(input: {
    tokens: CameraVendorTokens;
    vendorCameraId: string;
  }): Promise<{ contentType: string; bytes: Uint8Array }>;

  sendPtzCommand?(input: {
    tokens: CameraVendorTokens;
    vendorCameraId: string;
    command: CameraPtzCommand;
  }): Promise<void>;
}
