"use client";

import * as React from "react";

/**
 * Invisible presence beacon: pings /api/heartbeat once a minute while a
 * signed-in page is open, so this account shows the "Active now" dot in the
 * messenger (app + web). Fire-and-forget — failures are ignored.
 */
export function PresenceHeartbeat() {
  React.useEffect(() => {
    const beat = () => {
      void fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 60_000);
    return () => clearInterval(timer);
  }, []);
  return null;
}
