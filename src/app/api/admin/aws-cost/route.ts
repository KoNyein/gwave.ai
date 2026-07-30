import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { getAwsCostReport } from "@/lib/aws/cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Force a fresh Cost Explorer read, bypassing the six-hour cache.
 *
 * POST-only and admin-only on purpose: each call is three billed API requests
 * (~$0.03), so it must not be something a crawler or a stray GET can trigger.
 */
export async function POST() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const report = await getAwsCostReport(true);
  console.log(`[admin/aws-cost] forced refresh by=${profile.id}`);
  return NextResponse.json({
    ok: true,
    fetchedAt: report.fetchedAt,
    error: report.error,
  });
}
