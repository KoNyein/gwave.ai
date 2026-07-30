import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { isAdultBirthDate } from "@/lib/age";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Report a place on the community cannabis map — wrong address, closed down,
 * a fake listing. One report per person per place (the table's unique
 * constraint), so re-reporting rewrites the reason instead of inflating the
 * count; report_count is then recomputed from the rows rather than incremented,
 * which keeps it honest even after a re-report or a cascade delete.
 *
 * The admin queue at /admin/places reads the count and the reasons.
 */
const schema = z.object({
  placeId: z.string().uuid(),
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
  let adult = false;
  const admin = createAdminClient();
  if (id) {
    const { data } = await admin
      .from("profiles")
      .select("birth_date")
      .eq("id", id)
      .maybeSingle<{ birth_date: string | null }>();
    adult = isAdultBirthDate(data?.birth_date ?? null);
  } else {
    const profile = await getCurrentProfile();
    if (profile) {
      id = profile.id;
      adult = isAdultBirthDate(profile.birth_date);
    }
  }
  if (!id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!adult) {
    return NextResponse.json({ error: "18+ only." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }
  const { placeId, reason } = parsed.data;

  const { error } = await admin
    .from("cannabis_place_reports")
    .upsert(
      { place_id: placeId, reporter_id: id, reason },
      { onConflict: "place_id,reporter_id" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recompute rather than increment: idempotent under re-reports.
  const { count } = await admin
    .from("cannabis_place_reports")
    .select("id", { count: "exact", head: true })
    .eq("place_id", placeId);
  await admin
    .from("cannabis_places")
    .update({ report_count: count ?? 1 })
    .eq("id", placeId);

  console.log(`[cannabis/places] report by=${id} place=${placeId}`);
  return NextResponse.json({ ok: true });
}
