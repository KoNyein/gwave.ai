import "server-only";

import { getFitbitConfig, publicEnv } from "@/lib/env";

/**
 * Fitbit Web API client (free — https://dev.fitbit.com). Authorization Code
 * OAuth: the browser is sent to Fitbit, comes back with a `code`, we exchange it
 * for access + refresh tokens and then pull steps / heart rate / sleep on a
 * schedule (poll — Fitbit has no push for a hobby app).
 *
 * ALL Fitbit/provider logic lives in this one file, so swapping the health
 * provider only touches here (+ env). Every function no-ops when Fitbit isn't
 * configured, mirroring the app's other optional integrations.
 */
const AUTHORIZE = "https://www.fitbit.com/oauth2/authorize";
const TOKEN = "https://api.fitbit.com/oauth2/token";
const REVOKE = "https://api.fitbit.com/oauth2/revoke";
const API = "https://api.fitbit.com";
const SCOPES = "activity heartrate sleep profile";

function redirectUri(): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/health/fitbit/callback`;
}

function basicAuth(): string | null {
  const cfg = getFitbitConfig();
  if (!cfg) return null;
  return Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
}

/** The URL to send the user to so they authorize on Fitbit. `state` is CSRF. */
export function buildAuthUrl(state: string): string | null {
  const cfg = getFitbitConfig();
  if (!cfg) return null;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTHORIZE}?${params.toString()}`;
}

export interface FitbitTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
  scope: string;
  userId: string; // Fitbit's user id
}

function parseTokens(json: unknown): FitbitTokens | null {
  const t = json as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    user_id?: string;
  };
  if (!t.access_token || !t.refresh_token) return null;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: new Date(Date.now() + (t.expires_in ?? 28800) * 1000).toISOString(),
    scope: t.scope ?? SCOPES,
    userId: t.user_id ?? "",
  };
}

/** Exchange the callback `code` for tokens. */
export async function exchangeCode(code: string): Promise<FitbitTokens | null> {
  const auth = basicAuth();
  if (!auth) return null;
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) return null;
  return parseTokens(await res.json());
}

/** Trade a refresh token for a fresh access token (Fitbit rotates both). */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<FitbitTokens | null> {
  const auth = basicAuth();
  if (!auth) return null;
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  return parseTokens(await res.json());
}

/** Revoke an access token at Fitbit (best-effort, on disconnect). */
export async function revokeToken(accessToken: string): Promise<void> {
  const auth = basicAuth();
  if (!auth) return;
  await fetch(REVOKE, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token: accessToken }),
  }).catch(() => undefined);
}

export interface NormalizedMetric {
  metric_type: string;
  value: number;
  unit: string | null;
  recorded_at: string; // ISO
}

async function getJson(
  accessToken: string,
  path: string,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Accept-Language": "en_US" },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Pull one day's steps / calories / active-minutes / resting-HR / sleep for a
 * user and return them as normalized rows. `date` is YYYY-MM-DD. Fitbit's daily
 * figures are cumulative, so a re-sync of the same day upserts the latest value.
 */
export async function fetchDay(
  accessToken: string,
  date: string,
): Promise<NormalizedMetric[]> {
  const at = `${date}T23:59:59Z`;
  const out: NormalizedMetric[] = [];
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const [activity, heart, sleep] = await Promise.all([
    getJson(accessToken, `/1/user/-/activities/date/${date}.json`),
    getJson(accessToken, `/1/user/-/activities/heart/date/${date}/1d.json`),
    getJson(accessToken, `/1.2/user/-/sleep/date/${date}.json`),
  ]);

  const summary = activity?.summary as
    | {
        steps?: number;
        caloriesOut?: number;
        veryActiveMinutes?: number;
        fairlyActiveMinutes?: number;
      }
    | undefined;
  const steps = num(summary?.steps);
  if (steps !== null) out.push({ metric_type: "steps", value: steps, unit: "count", recorded_at: at });
  const kcal = num(summary?.caloriesOut);
  if (kcal !== null) out.push({ metric_type: "calories", value: kcal, unit: "kcal", recorded_at: at });
  const active =
    (num(summary?.veryActiveMinutes) ?? 0) + (num(summary?.fairlyActiveMinutes) ?? 0);
  if (summary?.veryActiveMinutes != null || summary?.fairlyActiveMinutes != null) {
    out.push({ metric_type: "active_minutes", value: active, unit: "min", recorded_at: at });
  }

  const heartArr = heart?.["activities-heart"] as
    | Array<{ value?: { restingHeartRate?: number } }>
    | undefined;
  const resting = num(heartArr?.[0]?.value?.restingHeartRate);
  if (resting !== null) {
    out.push({ metric_type: "resting_hr", value: resting, unit: "bpm", recorded_at: at });
    // No intraday scope here, so use resting HR as the day's representative HR.
    out.push({ metric_type: "heart_rate", value: resting, unit: "bpm", recorded_at: at });
  }

  const sleepSummary = sleep?.summary as { totalMinutesAsleep?: number } | undefined;
  const asleep = num(sleepSummary?.totalMinutesAsleep);
  if (asleep !== null) out.push({ metric_type: "sleep", value: asleep, unit: "min", recorded_at: at });

  return out;
}
