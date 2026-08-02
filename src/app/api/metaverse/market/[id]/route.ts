import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";
import { marketEnabled } from "@/lib/metaverse/market";

export const dynamic = "force-dynamic";

/// Marketplace — buy (POST) / cancel (DELETE) (Phase 19.3)。
///
/// ★ ရောင်းဝယ်မှုတစ်ခုလုံးက DB function `mv_market_buy` ရဲ့ transaction
///   တစ်ခုတည်းအတွင်း — ငွေဖြတ်၊ ကော်မရှင်ခွဲ၊ escrow ကနေ ပစ္စည်းလွှဲ၊
///   listing ပိတ်။ တစ်ဆင့်ကျရင် အားလုံး ROLLBACK。
/// ★ Idempotency key က client ကနေ လာတယ် — "ဝယ်မယ်" ကို ၂ ခါနှိပ်ရင်
///   key တူလို့ တစ်ခါပဲ ဖြတ်တယ်။

const buySchema = z.object({ idempotencyKey: z.string().min(8).max(80) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!marketEnabled()) {
    return NextResponse.json({ error: "Marketplace မဖွင့်ရသေးပါ" }, { status: 403 });
  }
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId < 1) {
    return NextResponse.json({ error: "Listing မမှန်ပါ" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON မမှန်ပါ" }, { status: 400 });
  }
  const parsed = buySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "idempotencyKey လိုပါတယ်" }, { status: 400 });
  }

  const db = await createClient();
  const { error } = await db.rpc("mv_market_buy", {
    p_listing_id: listingId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!marketEnabled()) {
    return NextResponse.json({ error: "Marketplace မဖွင့်ရသေးပါ" }, { status: 403 });
  }
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId < 1) {
    return NextResponse.json({ error: "Listing မမှန်ပါ" }, { status: 400 });
  }

  const db = await createClient();
  const { error } = await db.rpc("mv_market_cancel", { p_listing_id: listingId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
