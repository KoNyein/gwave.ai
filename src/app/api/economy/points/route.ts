import { NextResponse } from "next/server";

import { economyDb, requireProfile, unauthorized } from "@/lib/economy/server";

export const dynamic = "force-dynamic";

/** GET /api/economy/points — ကိုယ့် G-Points လက်ကျန် + မှတ်တမ်း။ */
export async function GET() {
  const profile = await requireProfile();
  if (!profile) return unauthorized();
  const db = economyDb();
  const [{ data: bal }, { data: hist }] = await Promise.all([
    db
      .from("gwave_points")
      .select("balance")
      .eq("profile_id", profile.id)
      .maybeSingle<{ balance: number }>(),
    db
      .from("gwave_points_tx")
      .select("delta, reason, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return NextResponse.json({ balance: bal?.balance ?? 0, history: hist ?? [] });
}
