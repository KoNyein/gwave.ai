import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  insertMetrics,
  recomputeDailySummaries,
  saveConnection,
} from "@/lib/db/health";
import { publicEnv } from "@/lib/env";
import { getProvider } from "@/lib/health/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "health_oauth_state";

function back(ok: boolean): NextResponse {
  return NextResponse.redirect(
    `${publicEnv.NEXT_PUBLIC_SITE_URL}/health?connected=${ok ? "1" : "0"}`,
  );
}

/**
 * OAuth redirect target for any provider (/api/health/<provider>/callback).
 * Verifies the CSRF state, exchanges the code, stores the connection, and runs
 * an initial 7-day sync. Always redirects back to /health.
 */
export async function GET(
  request: Request,
  { params }: { params: { provider: string } },
) {
  const provider = getProvider(params.provider);
  if (!provider || !provider.isEnabled()) return back(false);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.match(/(?:^|; )health_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || !expectedState || state !== expectedState) {
    return back(false);
  }

  const user = await getCurrentUser();
  if (!user) return back(false);

  const tokens = await provider.exchangeCode(code);
  if (!tokens) return back(false);

  await saveConnection(user.id, provider.id, tokens);

  // Best-effort initial sync so /health isn't empty on arrival.
  try {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    }
    const metrics = (
      await Promise.all(days.map((d) => provider.fetchDay(tokens.accessToken, d)))
    ).flat();
    await insertMetrics(user.id, provider.id, metrics);
    await recomputeDailySummaries(user.id, days);
  } catch {
    // A failed initial sync is fine — the user can hit "Sync".
  }

  const res = back(true);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
