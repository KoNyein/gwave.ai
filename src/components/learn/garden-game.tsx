"use client";

import * as React from "react";
import { Droplets, RotateCcw, Sprout, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Grow-a-Garden: a gentle STEM game. Each plant needs water + sunlight to move
// through its life stages. Teaches the "plants need water and light" idea from
// the Science Starters track. No network, no accounts — pure client state.

type Stage = 0 | 1 | 2 | 3 | 4; // seed → sprout → small → leafy → bloom
const STAGE_EMOJI = ["🌰", "🌱", "🌿", "🪴", "🌻"];
const STAGE_NAME = ["Seed", "Sprout", "Seedling", "Leafy", "Bloom!"];
const WATER_PER_STAGE = 3;
const SUN_PER_STAGE = 3;

interface Plot {
  stage: Stage;
  water: number;
  sun: number;
}

const PLOTS = 6;

export function GardenGame() {
  const [plots, setPlots] = React.useState<Plot[]>(() =>
    Array.from({ length: PLOTS }, () => ({ stage: 0 as Stage, water: 0, sun: 0 })),
  );
  const [tool, setTool] = React.useState<"water" | "sun">("water");

  const blooms = plots.filter((p) => p.stage === 4).length;

  function tend(index: number) {
    setPlots((prev) =>
      prev.map((plot, i) => {
        if (i !== index || plot.stage === 4) return plot;
        const next = { ...plot };
        if (tool === "water") next.water += 1;
        else next.sun += 1;
        // Advance a stage once BOTH needs are met, then reset the meters.
        if (next.water >= WATER_PER_STAGE && next.sun >= SUN_PER_STAGE) {
          next.stage = (next.stage + 1) as Stage;
          next.water = 0;
          next.sun = 0;
        }
        return next;
      }),
    );
  }

  function reset() {
    setPlots(
      Array.from({ length: PLOTS }, () => ({
        stage: 0 as Stage,
        water: 0,
        sun: 0,
      })),
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={tool === "water" ? "default" : "outline"}
              onClick={() => setTool("water")}
            >
              <Droplets className="mr-1 h-4 w-4" /> Water
            </Button>
            <Button
              size="sm"
              variant={tool === "sun" ? "default" : "outline"}
              onClick={() => setTool("sun")}
            >
              <Sun className="mr-1 h-4 w-4" /> Sunlight
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Blooms: <span className="font-semibold text-primary">{blooms}</span>{" "}
            / {PLOTS}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Pick a tool, then tap a plot. Every plant needs{" "}
          <strong>both water and sunlight</strong> to grow to the next stage —
          just like real plants!
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {plots.map((plot, i) => (
            <button
              key={i}
              type="button"
              onClick={() => tend(i)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-transform active:scale-95",
                plot.stage === 4
                  ? "border-primary bg-primary/10"
                  : "border-dashed hover:bg-muted",
              )}
              aria-label={`Plot ${i + 1}: ${STAGE_NAME[plot.stage]}`}
            >
              <span className="text-4xl" aria-hidden>
                {STAGE_EMOJI[plot.stage]}
              </span>
              <span className="text-xs font-medium">{STAGE_NAME[plot.stage]}</span>
              {plot.stage < 4 && (
                <span className="flex gap-2 text-[10px] text-muted-foreground">
                  <span>💧 {plot.water}/{WATER_PER_STAGE}</span>
                  <span>☀️ {plot.sun}/{SUN_PER_STAGE}</span>
                </span>
              )}
            </button>
          ))}
        </div>

        {blooms === PLOTS ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-secondary p-3">
            <p className="flex items-center gap-2 font-semibold">
              <Sprout className="h-5 w-5 text-primary" /> Your whole garden is in
              bloom! 🎉
            </p>
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="mr-1 h-4 w-4" /> Play again
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={reset} className="w-full">
            <RotateCcw className="mr-1 h-4 w-4" /> Reset garden
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
