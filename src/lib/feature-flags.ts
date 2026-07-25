const enabled = (value: string | undefined, fallback = false): boolean => {
  if (value == null || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
};

/**
 * Server-readable feature switches. Defaults preserve current behaviour.
 * Keep these small and operational: they are emergency kill switches, not a
 * replacement for product authorization.
 */
export const featureFlags = {
  dropshipping: enabled(process.env.FEATURE_DROPSHIPPING),
  ivsLive: enabled(process.env.FEATURE_IVS_LIVE, true),
  chimeCalls: enabled(process.env.FEATURE_CHIME_CALLS),
  cctv: enabled(process.env.FEATURE_CCTV, true),
  health: enabled(process.env.FEATURE_HEALTH, true),
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
