import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getEnabledCameraVendorConnectors } from "@/lib/cctv/vendors/registry";
import { isVendorCloudEnabled, listVendorConnections } from "@/lib/db/cctv-vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cctv/vendors — the enabled vendor providers, plus (when signed
 * in) the caller's own connections. Safe metadata only; with the feature
 * flag off the list is simply empty, so every client renders nothing.
 */
export async function GET() {
  if (!(await isVendorCloudEnabled())) {
    return NextResponse.json({ providers: [], connections: [] });
  }
  const providers = getEnabledCameraVendorConnectors().map((c) => ({
    id: c.id,
    label: c.label,
    accountLinking: true,
  }));
  const user = await getCurrentUser();
  const connections = user ? await listVendorConnections(user.id) : [];
  return NextResponse.json(
    { providers, connections },
    { headers: { "Cache-Control": "no-store" } },
  );
}
