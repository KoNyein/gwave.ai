import { NextResponse } from "next/server";

import { economyDb, requireProfile, unauthorized } from "@/lib/economy/server";

export const dynamic = "force-dynamic";

/** GET /api/economy/inventory — ကိုယ်ပိုင် item များ (flat queries,
 *  code ထဲ ပေါင်း — PostgREST embed မသုံး, house rule)။ */
export async function GET() {
  const profile = await requireProfile();
  if (!profile) return unauthorized();
  const db = economyDb();
  const { data: rows, error } = await db
    .from("gwave_user_items")
    .select("id, item_id, serial_no, equipped, locked, acquired_via")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  const ids = [...new Set((rows ?? []).map((r) => r.item_id))];
  const items = new Map<
    string,
    {
      sku: string;
      name: string;
      name_my: string | null;
      category: string;
      rarity: string;
      asset_url: string | null;
      thumbnail_url: string | null;
    }
  >();
  if (ids.length > 0) {
    const { data: defs } = await db
      .from("gwave_items")
      .select("id, sku, name, name_my, category, rarity, asset_url, thumbnail_url")
      .in("id", ids);
    for (const d of defs ?? []) items.set(d.id as string, d);
  }
  return NextResponse.json(
    (rows ?? []).map((r) => ({
      id: r.id,
      serial_no: r.serial_no,
      equipped: r.equipped,
      locked: r.locked,
      acquired_via: r.acquired_via,
      ...(items.get(r.item_id) ?? {
        sku: "?",
        name: "Unknown",
        name_my: null,
        category: "other",
        rarity: "common",
        asset_url: null,
        thumbnail_url: null,
      }),
    })),
  );
}
