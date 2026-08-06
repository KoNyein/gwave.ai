import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  economyDb,
  economyError,
  requireProfile,
  unauthorized,
} from "@/lib/economy/server";

export const dynamic = "force-dynamic";

const schema = z.object({ userItemId: z.string().uuid() });

/** POST /api/economy/equip — category တူ တခြားဟာ ချွတ်ပြီး ဒါတပ်။ */
export async function POST(req: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }
  const { error } = await economyDb().rpc("fn_equip", {
    p_profile: profile.id,
    p_user_item: parsed.data.userItemId,
  });
  if (error) return economyError(error.message);
  return NextResponse.json({ ok: true });
}
