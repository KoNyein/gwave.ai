import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getFreshVendorTokens } from "@/lib/cctv/vendor-service";
import { isVendorError, safeErrorCode } from "@/lib/cctv/vendors/errors";
import { getEnabledCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import {
  getVendorConnectionForService,
  isVendorCloudEnabled,
} from "@/lib/db/cctv-vendors";
import { getMyCamera } from "@/lib/db/cctv";
import { checkAuthRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cctv/cameras/[cameraId]/snapshot — a still frame from a
 * vendor-cloud camera. Owner-only (getMyCamera is owner-scoped), requires
 * the snapshot capability, rate-limited, never cached. This is what camera
 * walls should show instead of an auto-opened live session (§14.4).
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ cameraId: string }> },
) {
  const params = await props.params;
  if (!(await checkAuthRateLimit("cam_snapshot", 20, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!(await isVendorCloudEnabled())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const camera = await getMyCamera(user.id, params.cameraId);
  if (!camera || camera.camera_type !== "vendor_cloud") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const connector = camera.vendor_provider
    ? getEnabledCameraVendorConnector(camera.vendor_provider)
    : null;
  if (
    !connector?.getSnapshot ||
    !camera.vendor_connection_id ||
    !camera.vendor_camera_id ||
    camera.vendor_capabilities?.snapshot !== true
  ) {
    return NextResponse.json({ error: "unsupported" }, { status: 400 });
  }
  const connection = await getVendorConnectionForService(camera.vendor_connection_id);
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "relink_required" }, { status: 409 });
  }

  try {
    const tokens = await getFreshVendorTokens(connection.id, connector);
    const snap = await connector.getSnapshot({
      tokens,
      vendorCameraId: camera.vendor_camera_id,
    });
    return new NextResponse(Buffer.from(snap.bytes), {
      headers: {
        "Content-Type": snap.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const code = safeErrorCode(e);
    const auth = isVendorError(e) && (code === "auth_expired" || code === "auth_revoked");
    return NextResponse.json(
      { error: auth ? "relink_required" : code },
      { status: auth ? 409 : code === "rate_limited" ? 429 : 502 },
    );
  }
}
