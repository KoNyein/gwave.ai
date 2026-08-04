import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import {
  getFreshVendorTokens,
  listVendorCamerasCached,
} from "@/lib/cctv/vendor-service";
import { safeErrorCode } from "@/lib/cctv/vendors/errors";
import { getEnabledCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import {
  getVendorConnectionForOwner,
  importVendorCamera,
  isVendorCloudEnabled,
} from "@/lib/db/cctv-vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  connectionId: z.string().uuid(),
  cameraIds: z.array(z.string().min(1).max(200)).min(1).max(50),
});

/**
 * POST /api/cctv/vendors/[provider]/import — import the user's SELECTED
 * cameras (§11.4). Every id is validated against a fresh discovery of the
 * linked account, so a client cannot import a camera the account does not
 * have; only sanitized candidate data is stored, never a stream URL.
 */
export async function POST(
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

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // Ownership check: the connection must belong to the caller.
  const connection = await getVendorConnectionForOwner(
    user.id,
    parsed.data.connectionId,
  );
  if (!connection || connection.provider !== connector.id) {
    return NextResponse.json({ error: "no_connection" }, { status: 404 });
  }
  if (connection.status !== "connected") {
    return NextResponse.json({ error: "relink_required" }, { status: 409 });
  }

  try {
    const tokens = await getFreshVendorTokens(connection.id, connector);
    const available = await listVendorCamerasCached(connection.id, connector, tokens);
    const byId = new Map(available.map((c) => [c.vendorCameraId, c]));

    const results: Array<{ vendorCameraId: string; id: string | null; error?: string }> = [];
    for (const cameraId of parsed.data.cameraIds) {
      const candidate = byId.get(cameraId);
      if (!candidate) {
        results.push({ vendorCameraId: cameraId, id: null, error: "not_on_account" });
        continue;
      }
      const id = await importVendorCamera({
        userId: user.id,
        connectionId: connection.id,
        provider: connector.id,
        vendorCameraId: candidate.vendorCameraId,
        title: candidate.name,
        model: candidate.model,
        capabilities: { ...candidate.capabilities },
        safeMetadata: candidate.safeMetadata,
        streamId: `vc_${randomBytes(6).toString("hex")}`,
        shareToken: randomBytes(16).toString("hex"),
      });
      results.push(
        id
          ? { vendorCameraId: cameraId, id }
          : { vendorCameraId: cameraId, id: null, error: "already_imported" },
      );
    }
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: safeErrorCode(e) }, { status: 502 });
  }
}
