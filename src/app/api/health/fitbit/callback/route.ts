import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  insertMetrics,
  recomputeDailySummaries,
  saveFitbitConnection,
} from "@/lib/db/health";
import { isFitbitEnabled, publicEnv } from "@/lib/env";
import { exchangeCode, fetchDay } from "@/lib/health/fitbit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "fitbit_oauth_state";

function back(ok: boolean): NextResponse {
  return NextResponse.redirect(
    `${publicEnv.NEXT_PUBLIC_SITE_URL}/health?connected=${ok ? "1" : "0"}`,
  );
}

/**
 * Fitbit OAuth redirect target. Verifies the CSRF state, exchanges the code for
 * tokens, stores the connection, and kicks off an initial sync so the dashboard
 * has data straight away. Always redirects back to /health.
 */
export async function GET(request: Request) {
  if (!isFitbitEnabled()) return back(false);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.match(/(?:^|; )fitbit_oauth_state=([^;]+)/)?.[1];

  if (!code || !state || !expectedState || state !== expectedState) {
    return back(false);
  }

  const user = await getCurrentUser();
  if (!user) return back(false);

  const tokens = await exchangeCode(code);
  if (!tokens) return back(false);

  await saveFitbitConnection(user.id, tokens);

  // Best-effort initial sync (last 7 days) so /health isn't empty on arrival.
  try {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    }
    const metrics = (
      await Promise.all(days.map((d) => fetchDay(tokens.accessToken, d)))
    ).flat();
    await insertMetrics(user.id, metrics);
    await recomputeDailySummaries(user.id, days);
  } catch {
    // A failed initial sync is fine — the user can hit "Sync" on the page.
  }

  const res = back(true);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
