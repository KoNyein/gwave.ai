import { NextRequest, NextResponse } from "next/server";

import { authenticateApiRequest, parseLimit } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/data/admin";

/**
 * GET /api/v1/pos/products — products of the KEY OWNER's store with stock.
 * Scope: read:pos.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, "read:pos");
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data: store } = await admin
    .from("stores")
    .select("id, name, currency")
    .eq("owner_id", auth.key.owner_id)
    .limit(1)
    .maybeSingle();

  if (!store) {
    await auth.log(404);
    return NextResponse.json({ error: "No store" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("pos_products")
    .select(
      "id, name, sku, barcode, price, active, track_stock, inventory(quantity, low_stock_threshold)",
    )
    .eq("store_id", store.id)
    .order("name")
    .limit(parseLimit(request));

  const status = error ? 500 : 200;
  await auth.log(status);
  if (error) {
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ store: { name: store.name, currency: store.currency }, data });
}
