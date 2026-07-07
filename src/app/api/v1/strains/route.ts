import { NextRequest, NextResponse } from "next/server";

import { authenticateApiRequest, parseLimit } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/v1/strains?q=&type= — strain database. Scope: read:knowledge. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, "read:knowledge");
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  let query = admin
    .from("strains")
    .select(
      "name, slug, type, thc, cbd, effects, flavors, terpenes, grow_difficulty, flowering_weeks",
    )
    .order("name")
    .limit(parseLimit(request));

  const q = request.nextUrl.searchParams.get("q");
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const type = request.nextUrl.searchParams.get("type");
  if (type && ["indica", "sativa", "hybrid"].includes(type)) {
    query = query.eq("type", type as "indica" | "sativa" | "hybrid");
  }

  const { data, error } = await query;
  const status = error ? 500 : 200;
  await auth.log(status);
  if (error) {
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data });
}
