import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/audio/subscribe  { plan: "audio_monthly" | "audio_annual" }
 * Charges the G-Pay wallet and activates/extends the all-access subscription,
 * atomically inside `buy_audio_subscription`.
 */
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let plan = "audio_monthly";
  try {
    const body = (await req.json()) as { plan?: string };
    if (body.plan) plan = body.plan;
  } catch {
    /* default plan */
  }

  const db = (await createClient()) as unknown as {
    rpc(
      fn: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await db.rpc("buy_audio_subscription", { p_plan: plan });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, txn: data ?? null });
}
