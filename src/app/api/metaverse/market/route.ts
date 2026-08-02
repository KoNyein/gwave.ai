import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import { createClient } from "@/lib/data/server";
import { marketEnabled } from "@/lib/metaverse/market";

export const dynamic = "force-dynamic";

/// Marketplace — browse + list (Phase 19)。
///
/// ⚠️ `MV_MARKET_ENABLED` မဖွင့်ရင် route တိုင်း 403 — ဥပဒေခွင့်ပြုချက်
///    မရသေးလို့ (spec 19.0)。
/// ★ ငွေနဲ့ပစ္စည်း ရွှေ့တာ အကုန်လုံး DB function (SECURITY DEFINER) ထဲမှာ —
///   escrow lock, atomic buy, 5% commission, idempotency အားလုံး SQL မှာ
///   ရှိပြီး scratch PG မှာ integration test လုပ်ထားတယ်
///   (db/sql/metaverse-market.sql)。

const listSchema = z.object({
  kind: z.enum(["item", "plot"]),
  sku: z.string().min(1).max(64).optional(),
  plotId: z.number().int().min(0).optional(),
  priceMinor: z.number().int().min(1).max(10_000_000),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export async function GET(request: NextRequest) {
  if (!marketEnabled()) {
    return NextResponse.json({ error: "Marketplace မဖွင့်ရသေးပါ" }, { status: 403 });
  }

  const kind = request.nextUrl.searchParams.get("kind");
  const admin = createAdminClient();
  let q = admin
    .from("mv_listings")
    .select("id, seller_id, kind, sku, plot_id, price_minor, currency, expires_at, created_at")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(60);
  if (kind === "item" || kind === "plot") q = q.eq("kind", kind);

  const { data } = await q;
  return NextResponse.json(
    { listings: data ?? [] },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!marketEnabled()) {
    return NextResponse.json({ error: "Marketplace မဖွင့်ရသေးပါ" }, { status: 403 });
  }
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON မမှန်ပါ" }, { status: 400 });
  }
  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "ပုံစံ မမှန်ပါ" }, { status: 400 });
  }
  const { kind, sku, plotId, priceMinor, idempotencyKey } = parsed.data;
  if (kind === "item" && !sku) {
    return NextResponse.json({ error: "sku လိုပါတယ်" }, { status: 400 });
  }
  if (kind === "plot" && plotId === undefined) {
    return NextResponse.json({ error: "plotId လိုပါတယ်" }, { status: 400 });
  }

  // ★ User context client — RPC ထဲက auth.uid() က ဒီ session ရဲ့ user ဖြစ်ရမယ်။
  // Admin client နဲ့ ခေါ်ရင် auth.uid() က null ဖြစ်ပြီး function က ငြင်းတယ်။
  const db = await createClient();
  const { data, error } = await db.rpc("mv_market_list", {
    p_kind: kind,
    p_sku: sku ?? null,
    p_plot_id: plotId ?? null,
    p_price_minor: priceMinor,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (error) {
    // Function ရဲ့ message က ရှင်းပြီးသား ("You do not own this item" စသဖြင့်)
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return NextResponse.json({ ok: true, listingId: data });
}
