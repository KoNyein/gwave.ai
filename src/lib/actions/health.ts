"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/posts";
import { getCurrentUser } from "@/lib/auth";
import { isFitbitEnabled } from "@/lib/env";
import {
  buildAuthUrl,
  fetchDay,
  refreshAccessToken,
  revokeToken,
} from "@/lib/health/fitbit";
import {
  getSyncConnection,
  insertMetrics,
  recomputeDailySummaries,
  updateTokens,
} from "@/lib/db/health";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE = "fitbit_oauth_state";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Begin connecting Fitbit: stash a CSRF `state` and return the Fitbit authorize
 * URL for the browser to open. Fitbit redirects back to /api/health/fitbit/callback.
 */
export async function connectHealthProvider(): Promise<
  ActionResult<{ url: string }>
> {
  if (!isFitbitEnabled()) {
    return { ok: false, error: "Health sync is not enabled yet." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const state = crypto.randomUUID();
  const url = buildAuthUrl(state);
  if (!url) return { ok: false, error: "Could not start the connection." };

  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return { ok: true, data: { url } };
}

/**
 * Pull the last 7 days of Fitbit data for the caller: refresh the access token
 * if it's expired, fetch each day, store the metrics, and refresh the daily
 * summary. Safe to call repeatedly — days upsert on their natural key.
 */
export async function syncHealth(): Promise<ActionResult<{ days: number }>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const conn = await getSyncConnection(userId);
  if (!conn) return { ok: false, error: "No connected device." };

  let accessToken = conn.access_token;
  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0;
  if (expiresAt < Date.now() + 60_000) {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    if (!refreshed) {
      return { ok: false, error: "Please reconnect your device." };
    }
    await updateTokens(conn.id, refreshed);
    accessToken = refreshed.accessToken;
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  }

  const metrics = (
    await Promise.all(days.map((d) => fetchDay(accessToken, d)))
  ).flat();
  await insertMetrics(userId, metrics);
  await recomputeDailySummaries(userId, days);

  revalidatePath("/health");
  return { ok: true, data: { days: days.length } };
}

/** Disconnect Fitbit: revoke the token at Fitbit, then remove the row. */
export async function disconnectHealthDevice(
  connectionId: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const conn = await getSyncConnection(userId);
  if (conn?.access_token) await revokeToken(conn.access_token);

  const supabase = await createClient();
  const { error } = await supabase
    .from("health_connections" as never)
    .delete()
    .eq("id", connectionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/health");
  return { ok: true, data: undefined };
}
