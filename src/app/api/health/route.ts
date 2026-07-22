import { NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness + a cheap database reachability probe.
 * Used by Coolify health checks and uptime monitors.
 */
export async function GET() {
  const startedAt = Date.now();
  let database = "unknown";
  try {
    const response = await fetch(
      `${publicEnv.NEXT_PUBLIC_DATA_API_URL}/rest/v1/membership_plans?select=id&limit=1`,
      {
        headers: {
          apikey: publicEnv.NEXT_PUBLIC_DATA_API_KEY,
        },
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      },
    );
    database = response.ok ? "ok" : `error:${response.status}`;
  } catch {
    database = "unreachable";
  }

  const healthy = database === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
