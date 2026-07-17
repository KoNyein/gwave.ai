/**
 * Shared shapes for the health feature's pluggable providers. Each provider
 * (Fitbit, Google Fit, …) implements HealthProvider; the registry maps an id to
 * one. Adding a provider = one new module + a registry line — nothing else
 * changes.
 */
export interface NormalizedMetric {
  metric_type: string; // steps | heart_rate | resting_hr | sleep | calories | active_minutes
  value: number;
  unit: string | null;
  recorded_at: string; // ISO
}

export interface HealthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
  scope: string;
  userId: string; // the provider's own user id ("" when not applicable)
}

export interface HealthProvider {
  /** Stable id, also the URL segment: /api/health/<id>/callback. */
  id: string;
  label: string;
  isEnabled(): boolean;
  /** OAuth authorize URL to send the user to, or null when unconfigured. */
  buildAuthUrl(state: string): string | null;
  exchangeCode(code: string): Promise<HealthTokens | null>;
  refresh(refreshToken: string): Promise<HealthTokens | null>;
  revoke(accessToken: string): Promise<void>;
  /** One day's normalized metrics (date = YYYY-MM-DD). */
  fetchDay(accessToken: string, date: string): Promise<NormalizedMetric[]>;
}
