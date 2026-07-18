import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { verifyDataToken } from "@/lib/auth/tokens";
import { insertMetrics, recomputeDailySummaries } from "@/lib/db/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/health/ingest — the phone-bridge entry point.
 *
 * A companion mobile app (Android Health Connect / iOS HealthKit) reads the
 * phone's own health store and pushes normalized metrics here whenever it has
 * connectivity. Auth accepts either:
 *   - `Authorization: Bearer <data token>` — the app's own ES256 data token,
 *     verified locally (the token a mobile client holds after the Cognito
 *     sign-in flow; same token the web keeps in the gw_at cookie), or
 *   - the web session cookie (so the PWA itself can also post).
 *
 * Writes are idempotent on (user, metric_type, recorded_at) — resending a batch
 * upserts rather than duplicates — and the pre-aggregated daily summary is
 * refreshed for every day the batch touched.
 */
const MAX_BATCH = 500;

const ingestSchema = z.object({
  source: z.enum(["healthkit", "health_connect", "phone", "manual"]),
  metrics: z
    .array(
      z.object({
        metric_type: z.enum([
          "steps",
          "heart_rate",
          "resting_hr",
          "sleep",
          "calories",
          "active_minutes",
        ]),
        value: z.number().finite().min(0).max(1_000_000),
        unit: z.string().max(16).nullish(),
        recorded_at: z.string().datetime({ offset: true }),
      }),
    )
    .min(1)
    .max(MAX_BATCH),
});

async function resolveUserId(request: Request): Promise<string | null> {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    const claims = await verifyDataToken(bearer);
    if (claims) return claims.sub;
    return null; // an explicit bad token is rejected, not silently downgraded
  }
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  // Reject timestamps from the future (clock-skew tolerance: 1 day) so a buggy
  // client can't seed summaries for days that haven't happened.
  const limit = Date.now() + 86_400_000;
  const metrics = parsed.data.metrics
    .filter((m) => new Date(m.recorded_at).getTime() <= limit)
    .map((m) => ({
      metric_type: m.metric_type,
      value: Math.round(m.value),
      unit: m.unit ?? null,
      recorded_at: new Date(m.recorded_at).toISOString(),
    }));
  if (metrics.length === 0) {
    return NextResponse.json({ error: "No valid metrics" }, { status: 400 });
  }

  try {
    await insertMetrics(userId, parsed.data.source, metrics);
    const days = [...new Set(metrics.map((m) => m.recorded_at.slice(0, 10)))];
    await recomputeDailySummaries(userId, days);
    return NextResponse.json({ ok: true, inserted: metrics.length, days });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to store metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
