import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getFreshVendorTokens } from "@/lib/cctv/vendor-service";
import { safeErrorCode } from "@/lib/cctv/vendors/errors";
import { getEnabledCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import {
  getVendorConnectionForService,
  isVendorCloudEnabled,
} from "@/lib/db/cctv-vendors";
import { getMyCamera } from "@/lib/db/cctv";
import { checkAuthRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["move", "zoom", "stop", "preset"]),
  pan: z.number().min(-1).max(1).optional(),
  tilt: z.number().min(-1).max(1).optional(),
  zoom: z.number().min(-1).max(1).optional(),
  presetId: z.string().max(60).optional(),
});

/**
 * POST /api/cctv/cameras/[cameraId]/ptz — dispatch a PTZ command to a
 * vendor-cloud camera. Owner-only + explicit ptz capability (§15).
 * Non-vendor cameras keep their existing ptz_url path (PtzControls).
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ cameraId: string }> },
) {
  const params = await props.params;
  if (!(await checkAuthRateLimit("cam_ptz", 60, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!(await isVendorCloudEnabled())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const camera = await getMyCamera(user.id, params.cameraId);
  if (!camera || camera.camera_type !== "vendor_cloud") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const connector = camera.vendor_provider
    ? getEnabledCameraVendorConnector(camera.vendor_provider)
    : null;
  if (
    !connector?.sendPtzCommand ||
    !camera.vendor_connection_id ||
    !camera.vendor_camera_id ||
    camera.vendor_capabilities?.ptz !== true
  ) {
    return NextResponse.json({ error: "unsupported" }, { status: 400 });
  }
  const connection = await getVendorConnectionForService(camera.vendor_connection_id);
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "relink_required" }, { status: 409 });
  }

  try {
    const tokens = await getFreshVendorTokens(connection.id, connector);
    await connector.sendPtzCommand({
      tokens,
      vendorCameraId: camera.vendor_camera_id,
      command: parsed.data,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: safeErrorCode(e) }, { status: 502 });
  }
}
