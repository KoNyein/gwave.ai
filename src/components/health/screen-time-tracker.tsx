"use client";

import * as React from "react";
import { Smartphone } from "lucide-react";

const STORAGE_PREFIX = "gwave-screen-time:";
const TICK_MS = 15_000;
const SYNC_EVERY_MS = 2 * 60_000;

/** Local YYYY-MM-DD — screen time buckets by the user's own day. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readSeconds(day: string): number {
  const raw = localStorage.getItem(STORAGE_PREFIX + day);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Automatic screen-time tracking for time spent in Gwave. Browsers cannot read
 * the phone's overall OS screen time, so this measures what it can see — the
 * tab being visible — accumulates it per local day in localStorage, and syncs
 * the running daily total to /api/health/ingest every couple of minutes. The
 * ingest upsert keys on (metric_type, recorded_at), so re-sending the total
 * for the same day updates one row: daily synchronization for free. Overall
 * phone screen time can still be entered via the manual log.
 */
export function ScreenTimeTracker() {
  const [seconds, setSeconds] = React.useState<number | null>(null);
  const lastSynced = React.useRef(0);

  React.useEffect(() => {
    setSeconds(readSeconds(todayKey()));

    function tick() {
      if (document.visibilityState !== "visible") return;
      const day = todayKey();
      const next = readSeconds(day) + TICK_MS / 1000;
      localStorage.setItem(STORAGE_PREFIX + day, String(next));
      setSeconds(next);
    }

    async function sync() {
      const day = todayKey();
      const minutes = Math.floor(readSeconds(day) / 60);
      if (minutes < 1 || minutes === lastSynced.current) return;
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
        if (res.ok) lastSynced.current = minutes;
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

  const mins = seconds != null ? Math.floor(seconds / 60) : null;

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Screen time</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Gwave သုံးချိန်ကို အလိုအလျောက်တိုင်းပြီး နေ့စဉ် sync လုပ်ပေးသည်။
        ဖုန်းစုစုပေါင်း screen time ကိုတော့ အောက်က ကိုယ်တိုင်မှတ်တမ်းမှာ
        ထည့်နိုင်သည်။
      </p>
      <p className="text-2xl font-bold">
        {mins != null ? (
          <>
            {Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)} နာရီ ` : ""}
            {mins % 60} မိနစ်
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ဒီနေ့ (Gwave)
            </span>
          </>
        ) : (
          "—"
        )}
      </p>
    </div>
  );
}
