import { NextResponse } from "next/server";

import { economyDb } from "@/lib/economy/server";

export const dynamic = "force-dynamic";

/** GET /api/economy/items — ဆိုင်မှာ ရောင်းနေတဲ့ item များ (public data)။ */
export async function GET() {
  const { data, error } = await economyDb()
    .from("gwave_items")
    .select(
      "id, sku, name, name_my, category, rarity, thumbnail_url, price_points, max_supply, minted_count",
    )
    .eq("for_sale", true)
    .order("price_points", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  return NextResponse.json(data ?? []);
}
