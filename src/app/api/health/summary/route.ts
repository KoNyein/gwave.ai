import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getDailySummaries } from "@/lib/db/health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/summary?days=7 — the signed-in user's pre-aggregated daily
 * health summary for the dashboard chart. Owner-only (RLS + session guard).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const days = Math.min(
    90,
    Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 7),
  );
  const summaries = await getDailySummaries(user.id, days);
  return NextResponse.json({ summaries });
}
