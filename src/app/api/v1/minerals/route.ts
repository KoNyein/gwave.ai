import { NextRequest, NextResponse } from "next/server";

import { authenticateApiRequest, parseLimit } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/data/admin";

/** GET /api/v1/minerals?q=&category= — mineral database. Scope: read:knowledge. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, "read:knowledge");
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  let query = admin
    .from("minerals")
    .select("name, slug, symbol, category, hardness_mohs, density, uses")
    .order("name")
    .limit(parseLimit(request));

  const q = request.nextUrl.searchParams.get("q");
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const category = request.nextUrl.searchParams.get("category");
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  const status = error ? 500 : 200;
  await auth.log(status);
  if (error) {
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ data });
}
