import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  economyDb,
  economyError,
  requireProfile,
  unauthorized,
} from "@/lib/economy/server";

export const dynamic = "force-dynamic";

const schema = z.object({ itemId: z.string().uuid() });

/** POST /api/economy/buy — atomic ဝယ်ယူမှု (points ဖြတ် + mint)။ */
export async function POST(req: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }
  const { data, error } = await economyDb().rpc("fn_buy_item", {
    p_profile: profile.id,
    p_item: parsed.data.itemId,
  });
  if (error) return economyError(error.message);
  return NextResponse.json({ ok: true, userItemId: data });
}
