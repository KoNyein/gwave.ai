import "server-only";

import crypto from "node:crypto";

import { getTerraConfig } from "@/lib/env";

/**
 * Thin client for the Terra wearable-data aggregator (https://tryterra.co).
 *
 * Terra brokers the OAuth to each device provider (Garmin, Apple, Fitbit, Oura,
 * Samsung, …) and pushes normalized data to our webhook, so the app never talks
 * to a device vendor directly. All device/provider logic lives in THIS file —
 * swapping aggregator or provider set only touches here.
 *
 * Every function no-ops (or returns null) when Terra isn't configured, mirroring
 * the app's other optional integrations.
 */
const TERRA_BASE = "https://api.tryterra.co/v2";

function headers(): Record<string, string> | null {
  const cfg = getTerraConfig();
  if (!cfg) return null;
  return {
    "dev-id": cfg.devId,
    "x-api-key": cfg.apiKey,
    "Content-Type": "application/json",
  };
}

/**
 * Start a "Connect a device" flow. Returns the hosted widget URL to send the
 * user to (they pick a provider and log in there). `referenceId` is our own user
 * id, echoed back on every webhook so we can attribute the data.
 */
export async function generateWidgetSession(
  referenceId: string,
  redirectBase: string,
): Promise<{ url: string } | null> {
  const h = headers();
  if (!h) return null;
  const res = await fetch(`${TERRA_BASE}/auth/generateWidgetSession`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      reference_id: referenceId,
      providers:
        "GARMIN,FITBIT,OURA,SAMSUNG,GOOGLE,PELOTON,WITHINGS,SUUNTO,POLAR",
      language: "en",
      auth_success_redirect_url: `${redirectBase}/health?connected=1`,
      auth_failure_redirect_url: `${redirectBase}/health?connected=0`,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ? { url: data.url } : null;
}

/**
 * Verify a Terra webhook signature. Terra signs `${timestamp}.${rawBody}` with
 * HMAC-SHA256 and sends `terra-signature: t=<ts>,v1=<hex>`. Reject anything that
 * doesn't match so a stranger can't POST fake health data.
 */
export function verifyTerraSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const cfg = getTerraConfig();
  if (!cfg || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = crypto
    .createHmac("sha256", cfg.signingSecret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(v1, "hex"),
    );
  } catch {
    return false;
  }
}

/** Revoke a provider connection at Terra (best-effort). */
export async function deauthenticateUser(terraUserId: string): Promise<void> {
  const h = headers();
  if (!h) return;
  await fetch(
    `${TERRA_BASE}/auth/deauthenticateUser?user_id=${encodeURIComponent(terraUserId)}`,
    { method: "DELETE", headers: h },
  ).catch(() => undefined);
}

export interface NormalizedMetric {
  metric_type: string;
  value: number;
  unit: string | null;
  recorded_at: string; // ISO
}

/**
 * Flatten a Terra webhook payload into metric rows. Terra sends typed payloads
 * (`type: "daily" | "activity" | "sleep" | "body" | …`) each holding a `data`
 * array of samples; we pull the few fields the dashboard shows. Unknown shapes
 * are skipped, never thrown — a webhook must always 200 so Terra stops retrying.
 */
export function normalizePayload(payload: unknown): NormalizedMetric[] {
  const out: NormalizedMetric[] = [];
  const p = payload as {
    type?: string;
    data?: Array<Record<string, unknown>>;
  };
  if (!p?.data || !Array.isArray(p.data)) return out;

  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  for (const entry of p.data) {
    const meta = entry.metadata as { end_time?: string; start_time?: string } | undefined;
    const at = meta?.end_time ?? meta?.start_time ?? new Date().toISOString();

    if (p.type === "daily" || p.type === "activity") {
      const distance = entry.distance_data as
        | { steps?: number }
        | undefined;
      const steps = num(distance?.steps);
      if (steps !== null) out.push({ metric_type: "steps", value: steps, unit: "count", recorded_at: at });

      const hr = entry.heart_rate_data as
        | { summary?: { avg_hr_bpm?: number; resting_hr_bpm?: number } }
        | undefined;
      const avgHr = num(hr?.summary?.avg_hr_bpm);
      if (avgHr !== null) out.push({ metric_type: "heart_rate", value: avgHr, unit: "bpm", recorded_at: at });
      const restHr = num(hr?.summary?.resting_hr_bpm);
      if (restHr !== null) out.push({ metric_type: "resting_hr", value: restHr, unit: "bpm", recorded_at: at });

      const cals = entry.calories_data as
        | { total_burned_calories?: number }
        | undefined;
      const kcal = num(cals?.total_burned_calories);
      if (kcal !== null) out.push({ metric_type: "calories", value: kcal, unit: "kcal", recorded_at: at });

      const active = entry.active_durations_data as
        | { activity_seconds?: number }
        | undefined;
      const activeSec = num(active?.activity_seconds);
      if (activeSec !== null) out.push({ metric_type: "active_minutes", value: Math.round(activeSec / 60), unit: "min", recorded_at: at });
    }

    if (p.type === "sleep") {
      const durations = entry.sleep_durations_data as
        | { asleep?: { duration_asleep_state_seconds?: number } }
        | undefined;
      const sec = num(durations?.asleep?.duration_asleep_state_seconds);
      if (sec !== null) out.push({ metric_type: "sleep", value: Math.round(sec / 60), unit: "min", recorded_at: at });
    }
  }
  return out;
}
