import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  rounds: number;
  breaths: number;
  pace: string | null;
  retentions: number[] | null;
  best_s: number;
  created_at: string;
}

/**
 * POST /api/wellness/breath/session — auto-save a completed breathing session
 * (rounds, breaths, pace, per-round retention times) so a user's practice
 * history, personal best and streak follow them across devices. Owner-only RLS.
 */
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let b: { method?: string; rounds?: number; breaths?: number; pace?: string; retentions?: number[] };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const retentions = Array.isArray(b.retentions)
    ? b.retentions.map((n) => Math.max(0, Math.round(Number(n) || 0))).slice(0, 12)
    : [];
  const row = {
    user_id: profile.id,
    method: (b.method ?? "wim_hof").slice(0, 40),
    rounds: Math.max(1, Math.round(b.rounds ?? (retentions.length || 1))),
    breaths: Math.max(1, Math.round(b.breaths ?? 30)),
    pace: (b.pace ?? "medium").slice(0, 20),
    retentions,
    best_s: retentions.length ? Math.max(...retentions) : 0,
    total_s: retentions.reduce((a, c) => a + c, 0),
  };

  const db = (await createClient()) as unknown as {
    from(t: string): {
      insert(r: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
    };
  };
  const { error } = await db.from("breath_sessions").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * GET /api/wellness/breath/session — the viewer's recent sessions plus derived
 * stats (personal best, total count, current day-streak) for the progress panel.
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = (await createClient()) as unknown as {
    from(t: string): {
      select(c: string): {
        eq(col: string, v: unknown): {
          order(col: string, o: { ascending: boolean }): {
            limit(n: number): PromiseLike<{ data: Row[] | null }>;
          };
        };
      };
    };
  };
  const { data } = await db
    .from("breath_sessions")
    .select("id,rounds,breaths,pace,retentions,best_s,created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = data ?? [];
  const best = rows.reduce((m, r) => Math.max(m, r.best_s ?? 0), 0);

  // Current streak: consecutive calendar days (local UTC) ending today/yesterday.
  const days = new Set(rows.map((r) => r.created_at.slice(0, 10)));
  let streak = 0;
  const d = new Date();
  // allow the streak to count from today or yesterday
  if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setUTCDate(d.getUTCDate() - 1);
  }

  return NextResponse.json({
    sessions: rows.slice(0, 14).map((r) => ({
      id: r.id,
      best_s: r.best_s,
      rounds: r.rounds,
      at: r.created_at,
    })),
    best,
    count: rows.length,
    streak,
  });
}
