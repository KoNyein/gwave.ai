import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Report a pin on the community mine-site map — wrong location, closed years
 * ago, a fake listing, or a photo that doesn't belong to the site.
 *
 * One report per person per site (the table's unique constraint), so
 * re-reporting rewrites the reason instead of inflating the count;
 * report_count is then recomputed from the rows rather than incremented, which
 * keeps it honest even after a re-report or a cascade delete.
 *
 * The admin queue at /admin/mines reads the count and the reasons.
 */
const schema = z.object({
  siteId: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
});

function bearer(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : undefined;
}

export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  let id = claims?.sub ?? null;
  if (!id) {
    const profile = await getCurrentProfile();
    id = profile?.id ?? null;
  }
  if (!id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }
  const { siteId, reason } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("mine_site_reports")
    .upsert(
      { site_id: siteId, reporter_id: id, reason },
      { onConflict: "site_id,reporter_id" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recompute rather than increment: idempotent under re-reports.
  const { count } = await admin
    .from("mine_site_reports")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);
  await admin
    .from("mine_sites")
    .update({ report_count: count ?? 1 })
    .eq("id", siteId);

  console.log(`[mine/sites] report by=${id} site=${siteId}`);
  return NextResponse.json({ ok: true });
}
