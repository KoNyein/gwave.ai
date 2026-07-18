import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { HealthTokens, NormalizedMetric } from "@/lib/health/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Data-access for the health/wearable feature. The health tables are new and not
 * in the generated Database types yet, so we access them through an untyped view
 * of the client (return shapes declared below). Public reads use the
 * request-scoped client (RLS keeps them owner-private); token reads/writes use
 * the service-role admin client and never leave the server.
 */
function untyped(client: unknown): SupabaseClient {
  return client as unknown as SupabaseClient;
}

export interface HealthConnection {
  id: string;
  provider: string;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
}

export interface DailySummary {
  day: string;
  steps: number | null;
  avg_hr: number | null;
  resting_hr: number | null;
  sleep_minutes: number | null;
  calories: number | null;
  active_minutes: number | null;
  screen_minutes: number | null;
}

export interface SyncConnection {
  id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
}

// ── Public reads (RLS-scoped; token columns never selected) ─────────────────

export async function getConnections(
  userId: string,
): Promise<HealthConnection[]> {
  const db = untyped(await createClient());
  const { data } = await db
    .from("health_connections")
    .select("id, provider, status, connected_at, last_sync_at")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });
  return (data ?? []) as HealthConnection[];
}

export async function getDailySummaries(
  userId: string,
  days = 7,
): Promise<DailySummary[]> {
  const db = untyped(await createClient());
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data } = await db
    .from("health_daily_summary")
    .select("day, steps, avg_hr, resting_hr, sleep_minutes, calories, active_minutes, screen_minutes")
    .eq("user_id", userId)
    .gte("day", since)
    .order("day", { ascending: true });
  return (data ?? []) as DailySummary[];
}

export async function getLatestSummary(
  userId: string,
): Promise<DailySummary | null> {
  const db = untyped(await createClient());
  const { data } = await db
    .from("health_daily_summary")
    .select("day, steps, avg_hr, resting_hr, sleep_minutes, calories, active_minutes, screen_minutes")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as DailySummary | null;
}

// ── Connection lifecycle (service role) ─────────────────────────────────────

/** Create/replace a provider connection after its OAuth exchange. */
export async function saveConnection(
  userId: string,
  provider: string,
  tokens: HealthTokens,
): Promise<void> {
  const db = untyped(createAdminClient());
  // Primary write of the OAuth connection + tokens. On a self-hosted PostgREST an
  // error is a returned value, not a throw, so it was dropped and the callback
  // redirected "?connected=1" while no connection row existed. Throw so the
  // failure surfaces instead of a false success.
  const { error } = await db.from("health_connections").upsert(
    {
      user_id: userId,
      provider,
      terra_user_id: tokens.userId || `${provider}:${userId}`, // legacy NOT NULL
      provider_user_id: tokens.userId,
      status: "connected",
      connected_at: new Date().toISOString(),
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: tokens.expiresAt,
      scope: tokens.scope,
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(`saveConnection: ${error.message}`);
}

/** The caller's connection (with tokens) for a provider, for a sync. */
export async function getSyncConnection(
  userId: string,
  provider: string,
): Promise<SyncConnection | null> {
  const db = untyped(createAdminClient());
  const { data } = await db
    .from("health_connections")
    .select("id, provider, access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  return (data ?? null) as SyncConnection | null;
}

/** A connection by id (owner-scoped), for revoke-then-delete on disconnect. */
export async function getConnectionById(
  userId: string,
  connectionId: string,
): Promise<SyncConnection | null> {
  const db = untyped(createAdminClient());
  const { data } = await db
    .from("health_connections")
    .select("id, provider, access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("id", connectionId)
    .maybeSingle();
  return (data ?? null) as SyncConnection | null;
}

export async function updateTokens(
  connectionId: string,
  tokens: HealthTokens,
): Promise<void> {
  const db = untyped(createAdminClient());
  // If the provider rotated a single-use refresh token and this persist silently
  // fails, the connection breaks permanently with no error anywhere. Throw.
  const { error } = await db
    .from("health_connections")
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: tokens.expiresAt,
      scope: tokens.scope,
    })
    .eq("id", connectionId);
  if (error) throw new Error(`updateTokens: ${error.message}`);
}

export async function deleteConnection(
  userId: string,
  connectionId: string,
): Promise<string | null> {
  const supabase = untyped(await createClient());
  const { error } = await supabase
    .from("health_connections")
    .delete()
    .eq("id", connectionId);
  return error ? error.message : null;
}

// ── Metrics (service role) ──────────────────────────────────────────────────

/**
 * Store normalized metric rows. Upserts on the natural key so a re-synced day
 * (cumulative daily totals) overwrites the earlier value, and marks the
 * connection's last_sync_at.
 */
export async function insertMetrics(
  userId: string,
  provider: string,
  metrics: NormalizedMetric[],
): Promise<void> {
  if (metrics.length === 0) return;
  const db = untyped(createAdminClient());
  const rows = metrics.map((m) => ({
    user_id: userId,
    provider,
    metric_type: m.metric_type,
    value: m.value,
    unit: m.unit,
    recorded_at: m.recorded_at,
    day: m.recorded_at.slice(0, 10),
  }));
  // The synced wearable data — the whole point of a sync. Throw so a manual
  // "Sync" that writes nothing doesn't report success.
  const { error } = await db
    .from("health_metrics")
    .upsert(rows, { onConflict: "user_id,metric_type,recorded_at" });
  if (error) throw new Error(`insertMetrics: ${error.message}`);
  // last_sync_at is a best-effort timestamp: a failure here shouldn't fail an
  // otherwise-successful sync, so its error stays intentionally unchecked.
  await db
    .from("health_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
}

/**
 * Log one manually-entered (or phone-sensor) metric for today. No provider
 * connection needed — this is the account-free path so any phone can test.
 */
export async function insertManualMetric(
  userId: string,
  metricType: string,
  value: number,
  unit: string,
): Promise<void> {
  const db = untyped(createAdminClient());
  const now = new Date().toISOString();
  // The user manually logged this metric and is told it saved — throw rather than
  // silently drop it.
  const { error } = await db.from("health_metrics").upsert(
    {
      user_id: userId,
      provider: "manual",
      metric_type: metricType,
      value,
      unit,
      recorded_at: now,
      day: now.slice(0, 10),
    },
    { onConflict: "user_id,metric_type,recorded_at" },
  );
  if (error) throw new Error(`insertManualMetric: ${error.message}`);
}

/**
 * Recompute the pre-aggregated daily summary for the days a sync touched, so the
 * dashboard reads one row per day instead of scanning raw metrics.
 */
export async function recomputeDailySummaries(
  userId: string,
  days: string[],
): Promise<void> {
  const db = untyped(createAdminClient());
  for (const day of [...new Set(days)]) {
    const { data } = await db
      .from("health_metrics")
      .select("metric_type, value")
      .eq("user_id", userId)
      .eq("day", day);
    const rows = (data ?? []) as Array<{ metric_type: string; value: number }>;
    if (rows.length === 0) continue;

    const vals = (type: string) =>
      rows.filter((r) => r.metric_type === type).map((r) => r.value);
    const max = (a: number[]) => (a.length ? Math.max(...a) : null);
    const min = (a: number[]) => (a.length ? Math.min(...a) : null);
    const sum = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) : null);
    const avg = (a: number[]) =>
      a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;

    await db.from("health_daily_summary").upsert(
      {
        user_id: userId,
        day,
        steps: max(vals("steps")),
        avg_hr: avg(vals("heart_rate")),
        resting_hr: min(vals("resting_hr")),
        sleep_minutes: sum(vals("sleep")),
        calories: max(vals("calories")),
        active_minutes: max(vals("active_minutes")),
        // Reported as a cumulative daily total (tracker re-sends the running
        // total), so the max is the day's figure.
        screen_minutes: max(vals("screen_time")),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day" },
    );
  }
}
