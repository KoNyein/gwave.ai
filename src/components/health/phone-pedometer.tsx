"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Footprints, Loader2, Play, Save, Square } from "lucide-react";

import { logManualMetric } from "@/lib/actions/health";

/**
 * Phone-only step counter — no wearable, no account. Uses the browser's motion
 * sensor (DeviceMotion) to count steps while active, so any phone can test the
 * health feature immediately. Peak-detects on acceleration magnitude with a
 * refractory gap so a single stride counts once. "Save" logs the count as
 * today's steps.
 */
export function PhonePedometer() {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [steps, setSteps] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const lastPeakRef = React.useRef(0);
  const armedRef = React.useRef(true);

  const onMotion = React.useCallback((e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
    const now = Date.now();
    // Gravity ~9.8; a stride bumps magnitude well above it. Re-arm below 11.
    if (mag > 12.5 && armedRef.current && now - lastPeakRef.current > 300) {
      armedRef.current = false;
      lastPeakRef.current = now;
      setSteps((s) => s + 1);
    } else if (mag < 11) {
      armedRef.current = true;
    }
  }, []);

  async function start() {
    setError(null);
    // iOS 13+ requires an explicit permission grant from a user gesture.
    const DME = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DME.requestPermission === "function") {
      try {
        const res = await DME.requestPermission();
        if (res !== "granted") {
          setError("Motion sensor ခွင့်ပြုချက် လိုအပ်သည်။");
          return;
        }
      } catch {
        setError("ဒီ browser မှာ motion sensor မရနိုင်ပါ။");
        return;
      }
    }
    if (typeof DeviceMotionEvent === "undefined") {
      setError("ဒီစက်မှာ motion sensor မရှိပါ။");
      return;
    }
    window.addEventListener("devicemotion", onMotion);
    setRunning(true);
  }

  function stop() {
    window.removeEventListener("devicemotion", onMotion);
    setRunning(false);
  }

  React.useEffect(() => {
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [onMotion]);

  async function save() {
    if (steps === 0) return;
    setSaving(true);
    const res = await logManualMetric({ metricType: "steps", value: steps });
    setSaving(false);
    if (res.ok) {
      stop();
      setSteps(0);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Footprints className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">ဖုန်း ခြေလှမ်းတိုင်း</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        စက်မလိုပါ — ဖုန်းကို ကိုင်ပြီး လမ်းလျှောက်ပါ၊ ဖုန်းက ခြေလှမ်း ရေတွက်ပေးမည်။
      </p>
      <p className="text-center text-3xl font-bold tabular-nums">{steps}</p>
      <div className="flex justify-center gap-2">
        {running ? (
          <button
            type="button"
            onClick={stop}
            className="flex items-center gap-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white"
          >
            <Square className="h-4 w-4" /> ရပ်
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Play className="h-4 w-4" /> စတင်
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving || steps === 0}
          className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          သိမ်း
        </button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
