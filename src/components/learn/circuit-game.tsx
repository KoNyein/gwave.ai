"use client";

import * as React from "react";
import { Lightbulb, Plus, Power, RotateCcw, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Build-a-Circuit: the learner adds components (battery → wire → switch → LED)
// in order to complete the loop, then flips the switch to light the LED.
// Teaches that electricity needs a complete circuit — an Electronics & IoT
// foundation. Pure client state, mirrors the robot-game component pattern.

type Part = "battery" | "wire" | "switch" | "led";

const ORDER: Part[] = ["battery", "wire", "switch", "led"];

const PART_META: Record<
  Part,
  { label: string; icon: React.ComponentType<{ className?: string }>; emoji: string }
> = {
  battery: { label: "Battery", icon: Zap, emoji: "🔋" },
  wire: { label: "Wire", icon: Plus, emoji: "➖" },
  switch: { label: "Switch", icon: Power, emoji: "🔘" },
  led: { label: "LED", icon: Lightbulb, emoji: "💡" },
};

export function CircuitGame() {
  const [placed, setPlaced] = React.useState<Part[]>([]);
  const [switchOn, setSwitchOn] = React.useState(false);

  // The circuit is complete only when every part is placed in the right order.
  const complete =
    placed.length === ORDER.length && placed.every((p, i) => p === ORDER[i]);
  const lit = complete && switchOn;

  // The next part the learner should add (null once all are placed).
  const nextPart: Part | undefined = ORDER[placed.length];

  function add(part: Part) {
    if (placed.length >= ORDER.length) return;
    // Correct order advances; a wrong pick resets so the learner tries again.
    if (part === nextPart) {
      setPlaced((prev) => [...prev, part]);
    } else {
      setPlaced([]);
      setSwitchOn(false);
    }
  }

  function reset() {
    setPlaced([]);
    setSwitchOn(false);
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="text-xs text-muted-foreground">
          Add the parts in order to complete the loop:{" "}
          <strong>Battery → Wire → Switch → LED</strong>. Then flip the switch to
          light the LED 💡. Pick a wrong part and the circuit resets.
        </p>

        {/* Circuit board */}
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-muted/40 p-4">
          {ORDER.map((part, i) => {
            const isPlaced = i < placed.length;
            const meta = PART_META[part];
            const isLed = part === "led";
            return (
              <React.Fragment key={part}>
                {i > 0 && (
                  <span
                    className={cn(
                      "h-0.5 w-6 rounded",
                      lit
                        ? "bg-primary"
                        : isPlaced
                          ? "bg-foreground/40"
                          : "bg-border",
                    )}
                    aria-hidden
                  />
                )}
                <div
                  className={cn(
                    "flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 text-2xl transition-colors",
                    isPlaced
                      ? "border-primary bg-background"
                      : "border-dashed text-muted-foreground/40",
                    isLed && lit && "border-yellow-400 bg-yellow-100",
                  )}
                >
                  <span aria-hidden>
                    {isLed ? (lit ? "💡" : "⚪") : isPlaced ? meta.emoji : "＋"}
                  </span>
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {meta.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {lit && (
          <p className="rounded-lg bg-primary/10 p-2 text-center text-sm font-semibold text-primary">
            💡 The LED is glowing — you built a working circuit! 🎉
          </p>
        )}

        {/* Part palette */}
        <div className="flex flex-wrap gap-2">
          {ORDER.map((part) => {
            const meta = PART_META[part];
            const Icon = meta.icon;
            const done = placed.includes(part);
            return (
              <Button
                key={part}
                size="sm"
                variant="outline"
                onClick={() => add(part)}
                disabled={done}
              >
                <Icon className="mr-1 h-4 w-4" /> {meta.label}
              </Button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            size="sm"
            variant={switchOn ? "default" : "secondary"}
            onClick={() => setSwitchOn((s) => !s)}
            disabled={!complete}
          >
            <Power className="mr-1 h-4 w-4" />
            {switchOn ? "Switch OFF" : "Switch ON"}
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
        </div>

        {!complete && placed.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Keep going — add the {PART_META[nextPart ?? "led"].label} next.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
