import "server-only";

import { getGoogleFitConfig, publicEnv } from "@/lib/env";
import type { HealthProvider, HealthTokens, NormalizedMetric } from "@/lib/health/types";

/**
 * Google Fit provider (free, but the Google Fit REST API is DEPRECATED by
 * Google — kept as an optional secondary source). OAuth then the aggregate
 * dataset API for steps / calories / heart rate. All Google specifics live here.
 */
const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";
const AGGREGATE =
  "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";
const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
].join(" ");

function redirectUri(): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/health/google/callback`;
}

function parseTokens(json: unknown, fallbackRefresh = ""): HealthTokens | null {
  const t = json as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!t.access_token) return null;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? fallbackRefresh,
    expiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
    scope: t.scope ?? SCOPES,
    userId: "",
  };
}

async function tokenRequest(
  extra: Record<string, string>,
  fallbackRefresh = "",
): Promise<HealthTokens | null> {
  const cfg = getGoogleFitConfig();
  if (!cfg) return null;
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      ...extra,
    }),
  });
  if (!res.ok) return null;
  return parseTokens(await res.json(), fallbackRefresh);
}

interface AggPoint {
  value?: Array<{ intVal?: number; fpVal?: number }>;
}
interface AggDataset {
  point?: AggPoint[];
}
interface AggBucket {
  dataset?: AggDataset[];
}

export const googleFit: HealthProvider = {
  id: "google",
  label: "Google Fit",
  isEnabled: () => getGoogleFitConfig() !== null,

  buildAuthUrl(state) {
    const cfg = getGoogleFitConfig();
    if (!cfg) return null;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: cfg.clientId,
      redirect_uri: redirectUri(),
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${AUTHORIZE}?${params.toString()}`;
  },

  exchangeCode(code) {
    return tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    });
  },

  refresh(refreshToken) {
    return tokenRequest(
      { grant_type: "refresh_token", refresh_token: refreshToken },
      refreshToken,
    );
  },

  async revoke(accessToken) {
    await fetch(`${REVOKE}?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
    }).catch(() => undefined);
  },

  async fetchDay(accessToken, date) {
    const start = new Date(`${date}T00:00:00Z`).getTime();
    const end = start + 86_400_000;
    const res = await fetch(AGGREGATE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },
          { dataTypeName: "com.google.calories.expended" },
          { dataTypeName: "com.google.heart_rate.bpm" },
        ],
        bucketByTime: { durationMillis: 86_400_000 },
        startTimeMillis: start,
        endTimeMillis: end,
      }),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as { bucket?: AggBucket[] };
    const datasets = json.bucket?.[0]?.dataset ?? [];
    const at = `${date}T23:59:59Z`;
    const out: NormalizedMetric[] = [];

    const sumInt = (ds?: AggDataset) =>
      (ds?.point ?? []).reduce((s, p) => s + (p.value?.[0]?.intVal ?? 0), 0);
    const sumFp = (ds?: AggDataset) =>
      (ds?.point ?? []).reduce((s, p) => s + (p.value?.[0]?.fpVal ?? 0), 0);

    const steps = sumInt(datasets[0]);
    if (steps > 0) out.push({ metric_type: "steps", value: steps, unit: "count", recorded_at: at });
    const kcal = Math.round(sumFp(datasets[1]));
    if (kcal > 0) out.push({ metric_type: "calories", value: kcal, unit: "kcal", recorded_at: at });
    // Aggregated heart rate: value[0] is the average bpm for the bucket.
    const hrPoint = datasets[2]?.point?.[0]?.value?.[0]?.fpVal;
    if (typeof hrPoint === "number" && hrPoint > 0) {
      out.push({ metric_type: "heart_rate", value: Math.round(hrPoint), unit: "bpm", recorded_at: at });
    }
    return out;
  },
};
