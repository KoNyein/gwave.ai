"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/posts";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteConnection,
  getConnectionById,
  getSyncConnection,
  insertManualMetric,
  insertMetrics,
  recomputeDailySummaries,
  saveConnection,
  updateTokens,
} from "@/lib/db/health";
import { getProvider } from "@/lib/health/registry";

const STATE_COOKIE = "health_oauth_state";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Begin connecting a provider: stash a CSRF `state` and return its authorize
 * URL. The provider redirects back to /api/health/<id>/callback.
 */
export async function connectHealthProvider(
  providerId: string,
): Promise<ActionResult<{ url: string }>> {
  const provider = getProvider(providerId);
  if (!provider || !provider.isEnabled()) {
    return { ok: false, error: "This provider is not enabled." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const state = crypto.randomUUID();
  const url = provider.buildAuthUrl(state);
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

/** Pull the last 7 days for a connected provider (refresh token if needed). */
export async function syncHealth(
  providerId: string,
): Promise<ActionResult<{ days: number }>> {
  const provider = getProvider(providerId);
  if (!provider) return { ok: false, error: "Unknown provider." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const conn = await getSyncConnection(userId, providerId);
  if (!conn) return { ok: false, error: "No connected device." };

  let accessToken = conn.access_token;
  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0;
  if (expiresAt < Date.now() + 60_000) {
    const refreshed = await provider.refresh(conn.refresh_token);
    if (!refreshed) return { ok: false, error: "Please reconnect your device." };
    await updateTokens(conn.id, refreshed);
    accessToken = refreshed.accessToken;
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  }
  const metrics = (
    await Promise.all(days.map((d) => provider.fetchDay(accessToken, d)))
  ).flat();
  await insertMetrics(userId, providerId, metrics);
  await recomputeDailySummaries(userId, days);

  revalidatePath("/health");
  return { ok: true, data: { days: days.length } };
}

/** Disconnect a device: revoke at the provider, then remove the row. */
export async function disconnectHealthDevice(
  connectionId: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const conn = await getConnectionById(userId, connectionId);
  if (conn) {
    const provider = getProvider(conn.provider);
    if (provider && conn.access_token) await provider.revoke(conn.access_token);
  }
  const error = await deleteConnection(userId, connectionId);
  if (error) return { ok: false, error };

  revalidatePath("/health");
  return { ok: true, data: undefined };
}

const MANUAL_METRICS: Record<string, string> = {
  steps: "count",
  sleep: "min",
  calories: "kcal",
  heart_rate: "bpm",
};

/**
 * Log one manually-entered or phone-sensor metric for today. No account needed
 * — the account-free path so any phone can test the dashboard immediately.
 */
export async function logManualMetric(input: {
  metricType: string;
  value: number;
}): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const unit = MANUAL_METRICS[input.metricType];
  if (!unit) return { ok: false, error: "Unsupported metric." };
  if (!Number.isFinite(input.value) || input.value < 0 || input.value > 1_000_000) {
    return { ok: false, error: "Enter a valid number." };
  }

  await insertManualMetric(userId, input.metricType, Math.round(input.value), unit);
  const today = new Date().toISOString().slice(0, 10);
  await recomputeDailySummaries(userId, [today]);

  revalidatePath("/health");
  return { ok: true, data: undefined };
}
