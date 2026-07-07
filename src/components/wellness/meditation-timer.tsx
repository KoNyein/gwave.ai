"use client";

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Preset = { title: string; minutes: number; body: string | null };

export function MeditationTimer({ presets }: { presets: Preset[] }) {
  const options = React.useMemo(
    () =>
      presets.length
        ? presets
        : [{ title: "Quiet sitting", minutes: 5, body: null }],
    [presets],
  );

  const [selected, setSelected] = React.useState(0);
  const total = (options[selected]?.minutes ?? 5) * 60;
  const [remaining, setRemaining] = React.useState(total);
  const [running, setRunning] = React.useState(false);

  // Reset the clock whenever the preset changes.
  React.useEffect(() => {
    setRemaining((options[selected]?.minutes ?? 5) * 60);
    setRunning(false);
  }, [selected, options]);

  React.useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      // A gentle chime using the Web Audio API (no asset needed).
      try {
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 528;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + 2.5,
        );
        osc.start();
        osc.stop(ctx.currentTime + 2.5);
      } catch {
        // Audio not available — silent completion is fine.
      }
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [running, remaining]);

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <button
              key={o.title}
              type="button"
              onClick={() => setSelected(i)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                i === selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              {o.minutes} min
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 45}
                strokeDashoffset={2 * Math.PI * 45 * (1 - progress / 100)}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="text-3xl font-bold tabular-nums">
              {mm}:{ss}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setRunning((r) => !r)}
              disabled={remaining <= 0}
            >
              {running ? (
                <>
                  <Pause className="mr-1 h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="mr-1 h-4 w-4" /> Start
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRemaining(total);
                setRunning(false);
              }}
            >
              <RotateCcw className="mr-1 h-4 w-4" /> Reset
            </Button>
          </div>
        </div>

        {options[selected]?.body && (
          <p className="text-center text-sm text-muted-foreground">
            {options[selected]?.body}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
