"use client";

import * as React from "react";

import { createClient } from "@/lib/data/client";

/**
 * Reads a feature flag (publicly readable). Returns `defaultValue` until
 * loaded; missing flags resolve to `defaultValue`.
 *
 *   const posEnabled = useFeatureFlag("pos_v2", false);
 */
export function useFeatureFlag(key: string, defaultValue = false): boolean {
  const [enabled, setEnabled] = React.useState(defaultValue);

  React.useEffect(() => {
    let cancelled = false;
    const db = createClient();
    db
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setEnabled(data.enabled);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return enabled;
}
