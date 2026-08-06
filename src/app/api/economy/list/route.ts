import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  economyDb,
  economyError,
  requireProfile,
  unauthorized,
} from "@/lib/economy/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  userItemId: z.string().uuid(),
  pricePoints: z.number().int().positive().max(1_000_000),
});

/** POST /api/economy/list — ရောင်းစာရင်းတင် (item ကို lock)။ */
export async function POST(req: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "CANNOT_LIST" }, { status: 400 });
  }
  const { data, error } = await economyDb().rpc("fn_list_item", {
    p_profile: profile.id,
    p_user_item: parsed.data.userItemId,
    p_price: parsed.data.pricePoints,
  });
  if (error) return economyError(error.message);
  return NextResponse.json({ ok: true, listingId: data });
}
