import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/data/admin";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness, a cheap database reachability probe, and a probe
 * of the privileged (service_role) path.
 *
 * ★ The service_role probe is here because its absence hid an outage. This
 *   endpoint checked the database with the anon key only, so it stayed green
 *   while every server-side privileged write failed. Those writes are not a
 *   minor corner: the live announcement post, the follower notification claim,
 *   the recording bookkeeping and the replay sweeper all go through
 *   createAdminClient(). When the minted token stops being accepted, a
 *   broadcast still goes live and is still watchable — and gets no feed post,
 *   no saved recording and no replay, with a healthy status page above it.
 * ★ It reads one row of a public table. The point is only "is a service_role
 *   token still accepted", so nothing sensitive is touched or returned.
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

  let serviceRole = "unknown";
  try {
    const { error } = await createAdminClient()
      .from("membership_plans")
      .select("id")
      .limit(1);
    serviceRole = error ? `error:${error.code || error.message}` : "ok";
  } catch (e) {
    // A minting failure (missing or rotated signing key) throws rather than
    // returning an error object, and it is exactly the case worth catching.
    serviceRole = `unavailable:${e instanceof Error ? e.message : "unknown"}`;
  }

  // ★ Both legs gate the status. A green health check that only proves the
  //   anon key works is the thing that let this go unnoticed.
  const healthy = database === "ok" && serviceRole === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      service_role: serviceRole,
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
