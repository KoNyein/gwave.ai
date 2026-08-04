import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  getFreshVendorTokens,
  listVendorCamerasCached,
} from "@/lib/cctv/vendor-service";
import { isVendorError, safeErrorCode } from "@/lib/cctv/vendors/errors";
import { getEnabledCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import {
  isVendorCloudEnabled,
  listImportedVendorCameras,
  listVendorConnectionsForProvider,
} from "@/lib/db/cctv-vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cctv/vendors/[provider]/cameras — the cameras on the caller's
 * linked account, marked with which are already imported (§11.4).
 * `?connection=<id>` selects one of several linked accounts; the newest
 * connected one is the default.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ provider: string }> },
) {
  const params = await props.params;
  if (!(await isVendorCloudEnabled())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const connector = getEnabledCameraVendorConnector(params.provider);
  if (!connector) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await listVendorConnectionsForProvider(user.id, connector.id);
  const wanted = new URL(request.url).searchParams.get("connection");
  const connection = wanted
    ? connections.find((c) => c.id === wanted)
    : connections.find((c) => c.status === "connected");
  if (!connection) {
    return NextResponse.json({ error: "no_connection" }, { status: 404 });
  }
  if (connection.status !== "connected") {
    return NextResponse.json({ error: "relink_required" }, { status: 409 });
  }

  try {
    const tokens = await getFreshVendorTokens(connection.id, connector);
    const cameras = await listVendorCamerasCached(connection.id, connector, tokens);
    const imported = await listImportedVendorCameras(user.id, connection.id);
    const importedIds = new Set(imported.map((c) => c.vendor_camera_id));
    return NextResponse.json(
      {
        connection: { id: connection.id, label: connection.account_label },
        cameras: cameras.map((c) => ({
          ...c,
          alreadyImported: importedIds.has(c.vendorCameraId),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const code = safeErrorCode(e);
    const auth = isVendorError(e) && (code === "auth_expired" || code === "auth_revoked");
    return NextResponse.json(
      { error: auth ? "relink_required" : code },
      { status: auth ? 409 : code === "rate_limited" ? 429 : 502 },
    );
  }
}
