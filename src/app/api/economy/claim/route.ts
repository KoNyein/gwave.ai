import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  economyDb,
  economyError,
  requireProfile,
  unauthorized,
} from "@/lib/economy/server";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.literal("daily_login") });

/** POST /api/economy/claim — နေ့စဉ်ဆု +50 G (တစ်နေ့တစ်ခါ)။ */
export async function POST(req: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }
  const { data, error } = await economyDb().rpc("fn_claim_daily", {
    p_profile: profile.id,
  });
  if (error) return economyError(error.message);
  return NextResponse.json({ ok: true, balance: data });
}
