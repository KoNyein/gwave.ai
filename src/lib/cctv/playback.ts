/**
 * Pure playback logic for the common camera service
 * (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §13): who may view a
 * camera, and how a vendor session maps to the unified playback shape.
 * No imports beyond types — unit-testable without Next/db.
 */

import type { VendorPlaybackSession } from "@/lib/cctv/vendors/types";
import type { CameraVendorCapabilities } from "@/types/database";

/** The camera fields the authorization decision needs. */
export interface PlayableCamera {
  id: string;
  owner_id: string;
  camera_type: "webrtc" | "rtsp" | "kvs" | "vendor_cloud";
  stream_id: string;
  share_token: string;
  is_public: boolean;
  public_until: string | null;
  hls_url: string | null;
  vendor_provider: string | null;
  vendor_camera_id: string | null;
  vendor_connection_id: string | null;
  vendor_capabilities: CameraVendorCapabilities | null;
}

/** What the browser gets back from the stream endpoint. */
export type CameraPlaybackSession =
  | { kind: "embedded_media"; streamId: string }
  | { kind: "hls"; url: string; expiresAt?: string }
  | { kind: "kvs"; cameraId: string }
  | { kind: "vendor_webrtc"; provider: string; config: Record<string, unknown>; expiresAt?: string }
  | { kind: "unavailable"; reason: string; gatewayRecommended: boolean };

export type ViewDenial = "not_found" | "private" | "vendor_public_share_disabled";

/**
 * May this viewer watch this camera?
 *
 * Owner → always. Everyone else → the camera must be public (within any
 * temporary window) or matched by share token — EXCEPT vendor-cloud
 * cameras, which stay owner-only unless the provider explicitly declared
 * public sharing allowed (§11.5: contractual default is NO).
 */
export function canViewCamera(
  camera: PlayableCamera | null,
  viewer: { userId: string | null; shareToken?: string | null; now?: number },
): ViewDenial | null {
  if (!camera) return "not_found";
  if (viewer.userId && viewer.userId === camera.owner_id) return null;

  const now = viewer.now ?? Date.now();
  const publicActive =
    camera.is_public &&
    (!camera.public_until || new Date(camera.public_until).getTime() > now);
  const tokenMatch =
    !!viewer.shareToken && viewer.shareToken === camera.share_token;
  if (!publicActive && !tokenMatch) return "private";

  if (camera.camera_type === "vendor_cloud") {
    // Vendor terms decide, not the owner's toggle. Absent capabilities
    // (should not happen) fail closed.
    if (camera.vendor_capabilities?.publicSharingAllowed !== true) {
      return "vendor_public_share_disabled";
    }
  }
  return null;
}

/** Map a connector's session onto the unified playback union. */
export function mapVendorSession(
  provider: string,
  session: VendorPlaybackSession,
): CameraPlaybackSession {
  switch (session.kind) {
    case "hls":
      return { kind: "hls", url: session.url, expiresAt: session.expiresAt };
    case "webrtc":
      return {
        kind: "vendor_webrtc",
        provider,
        config: session.config,
        expiresAt: session.expiresAt,
      };
    case "media_server":
      // The temporary source is already registered with the gwave media
      // relay under this stream id — the browser talks only to our player.
      return { kind: "embedded_media", streamId: session.streamId };
    case "unsupported":
      return {
        kind: "unavailable",
        reason: session.reason,
        gatewayRecommended: session.gatewayRecommended,
      };
  }
}
