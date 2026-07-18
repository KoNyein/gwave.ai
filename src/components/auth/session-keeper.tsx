"use client";

import * as React from "react";

/** Browser-readable data token cookie (kept in sync with lib/auth/session.ts). */
const AT_COOKIE = "gw_at";

/**
 * Keeps the short-lived gw_at cookie alive for client-side callers. The cookie
 * has a 1-hour maxAge, so the browser silently deletes it mid-session while the
 * 30-day refresh token is still valid — after that, everything that talks to
 * PostgREST/Realtime straight from the browser (live chat, reactions, viewer
 * presence) loses auth until the next full page load. This checks on mount, on
 * tab re-focus, and every few minutes, and silently re-mints the token via
 * /api/auth/refresh when the cookie is gone.
 */
export function SessionKeeper() {
  React.useEffect(() => {
    let inFlight = false;

    async function ensure() {
      if (inFlight) return;
      if (document.cookie.includes(`${AT_COOKIE}=`)) return;
      inFlight = true;
      try {
        await fetch("/api/auth/refresh?silent=1", { cache: "no-store" });
      } catch {
        // Offline/transient — the next tick retries.
      } finally {
        inFlight = false;
      }
    }

    void ensure();
    const interval = setInterval(() => void ensure(), 5 * 60_000);
    const onVisible = () => {
      if (!document.hidden) void ensure();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
