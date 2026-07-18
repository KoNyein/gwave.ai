"use client";

import * as React from "react";

export const SCREEN_TIME_PREFIX = "gwave-screen-time:";
const TICK_MS = 15_000;
const SYNC_EVERY_MS = 2 * 60_000;

/** Local YYYY-MM-DD — screen time buckets by the user's own day. */
export function screenTimeDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function readScreenSeconds(day: string): number {
  const raw = localStorage.getItem(SCREEN_TIME_PREFIX + day);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Renderless, app-wide screen-time recorder — mounted once in the root layout
 * so EVERY page counts, not just /health. Accumulates visible-tab seconds per
 * local day in localStorage and re-sends the running daily total to
 * /api/health/ingest every couple of minutes and on tab hide. The ingest
 * upsert keys on (metric_type, recorded_at) with a fixed per-day timestamp,
 * so each sync updates one row: daily synchronization with no scheduler.
 * The /health card only displays what this records.
 */
export function ScreenTimeRecorder() {
  React.useEffect(() => {
    let lastSynced = 0;

    function tick() {
      if (document.visibilityState !== "visible") return;
      const day = screenTimeDayKey();
      const next = readScreenSeconds(day) + TICK_MS / 1000;
      localStorage.setItem(SCREEN_TIME_PREFIX + day, String(next));
    }

    async function sync() {
      const day = screenTimeDayKey();
      const minutes = Math.floor(readScreenSeconds(day) / 60);
      if (minutes < 1 || minutes === lastSynced) return;
      try {
        const res = await fetch("/api/health/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "phone",
            metrics: [
              {
                metric_type: "screen_time",
                value: minutes,
                unit: "min",
                // Fixed per-day timestamp so every sync updates the same row.
                recorded_at: `${day}T23:59:59Z`,
              },
            ],
          }),
        });
        if (res.ok) lastSynced = minutes;
      } catch {
        // Offline — the next interval retries.
      }
    }

    const tickId = setInterval(tick, TICK_MS);
    const syncId = setInterval(() => void sync(), SYNC_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void sync();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(tickId);
      clearInterval(syncId);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return null;
}
