import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/games/drone/score — record a lap time from the FPV drone simulator.
 * Keeps only the player's best per track (Champions League ladder). RLS enforces
 * that a user can only write their own row.
 */
const schema = z.object({
  track: z.string().min(1).max(60),
  ms: z.number().int().min(1000).max(600000),
});

// drone_race_scores isn't in the generated Database type (migrated on RDS).
interface ScoresClient {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: string,
      ): {
        eq(
          col: string,
          val: string,
        ): { maybeSingle(): PromiseLike<{ data: { best_ms: number } | null }> };
      };
    };
    upsert(
      values: Record<string, unknown>,
      opts: { onConflict: string },
    ): PromiseLike<{ error: { message: string } | null }>;
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid score." }, { status: 400 });
  }
  const { track, ms } = parsed.data;

  const sb = (await createClient()) as unknown as ScoresClient;
  const { data: existing } = await sb
    .from("drone_race_scores")
    .select("best_ms")
    .eq("user_id", user.id)
    .eq("track", track)
    .maybeSingle();

  if (existing && existing.best_ms <= ms) {
    return NextResponse.json({ ok: true, best: existing.best_ms, improved: false });
  }

  const { error } = await sb.from("drone_race_scores").upsert(
    {
      user_id: user.id,
      track,
      best_ms: ms,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,track" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, best: ms, improved: true });
}
