import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/audio/{trackId}/purchase
 * Buys a single track from the G-Pay wallet. All the money movement + the
 * entitlement grant happen atomically inside the `buy_audio` SQL function, so
 * there is never a debit without access (or access without a debit). Friendly
 * errors (insufficient balance, inactive wallet) are surfaced to the client.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = (await createClient()) as unknown as {
    rpc(
      fn: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await db.rpc("buy_audio", { p_track: trackId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, txn: data ?? null });
}
