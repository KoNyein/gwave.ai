import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canViewCamera,
  mapVendorSession,
  type CameraPlaybackSession,
  type PlayableCamera,
} from "@/lib/cctv/playback";
import { getFreshVendorTokens } from "@/lib/cctv/vendor-service";
import { isVendorError, safeErrorCode } from "@/lib/cctv/vendors/errors";
import { getEnabledCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import {
  getVendorConnectionForService,
  isVendorCloudEnabled,
} from "@/lib/db/cctv-vendors";
import { createAdminClient } from "@/lib/data/admin";

/**
 * Common camera service (§13): resolve → authorize → dispatch by source
 * type → normalized playback session. All camera types funnel through here
 * so the authorization rules exist exactly once.
 */

function untyped(client: unknown): SupabaseClient {
  return client as unknown as SupabaseClient;
}

const CAMERA_COLS =
  "id, owner_id, camera_type, stream_id, share_token, is_public, public_until, hls_url, vendor_provider, vendor_camera_id, vendor_connection_id, vendor_capabilities";

async function getPlayableCamera(cameraId: string): Promise<PlayableCamera | null> {
  // Service role: authorization is done in code (canViewCamera) because the
  // share-token path must work for anonymous viewers RLS knows nothing about.
  const db = untyped(createAdminClient());
  const { data } = await db
    .from("user_cameras")
    .select(CAMERA_COLS)
    .eq("id", cameraId)
    .maybeSingle();
  return (data ?? null) as PlayableCamera | null;
}

export type PlaybackResult =
  | { ok: true; session: CameraPlaybackSession }
  | { ok: false; error: string; status: number };

/**
 * The one entry point routes use. `shareToken` supports the public /watch
 * path; vendor-cloud cameras ignore it unless the provider explicitly
 * allows public sharing (they don't, today).
 */
export async function createAuthorizedCameraPlaybackSession(input: {
  cameraId: string;
  userId: string | null;
  shareToken?: string | null;
}): Promise<PlaybackResult> {
  const camera = await getPlayableCamera(input.cameraId);
  const denial = canViewCamera(camera, {
    userId: input.userId,
    shareToken: input.shareToken,
  });
  if (denial === "not_found") return { ok: false, error: "not_found", status: 404 };
  if (denial) return { ok: false, error: denial, status: 403 };
  const cam = camera!;

  switch (cam.camera_type) {
    case "kvs":
      return { ok: true, session: { kind: "kvs", cameraId: cam.id } };
    case "webrtc":
    case "rtsp":
      if (cam.hls_url) return { ok: true, session: { kind: "hls", url: cam.hls_url } };
      return { ok: true, session: { kind: "embedded_media", streamId: cam.stream_id } };
    case "vendor_cloud":
      return vendorSession(cam);
  }
}

async function vendorSession(cam: PlayableCamera): Promise<PlaybackResult> {
  if (!(await isVendorCloudEnabled())) {
    return { ok: false, error: "not_found", status: 404 };
  }
  const connector = cam.vendor_provider
    ? getEnabledCameraVendorConnector(cam.vendor_provider)
    : null;
  if (!connector || !cam.vendor_connection_id || !cam.vendor_camera_id) {
    return {
      ok: true,
      session: { kind: "unavailable", reason: "provider_disabled", gatewayRecommended: true },
    };
  }
  const connection = await getVendorConnectionForService(cam.vendor_connection_id);
  if (!connection || connection.status !== "connected") {
    return { ok: false, error: "relink_required", status: 409 };
  }

  try {
    const tokens = await getFreshVendorTokens(connection.id, connector);
    const vendorSess = await connector.createPlaybackSession({
      tokens,
      vendorCameraId: cam.vendor_camera_id,
    });
    // Best-effort liveness marker for the camera list; never blocks playback.
    void untyped(createAdminClient())
      .from("user_cameras")
      .update({ vendor_last_seen_at: new Date().toISOString() })
      .eq("id", cam.id)
      .then(() => undefined);
    return { ok: true, session: mapVendorSession(connector.id, vendorSess) };
  } catch (e) {
    const code = safeErrorCode(e);
    if (isVendorError(e) && (code === "auth_expired" || code === "auth_revoked")) {
      return { ok: false, error: "relink_required", status: 409 };
    }
    if (code === "camera_offline") {
      return { ok: false, error: "camera_offline", status: 503 };
    }
    return {
      ok: false,
      error: code,
      status: code === "rate_limited" ? 429 : 502,
    };
  }
}
