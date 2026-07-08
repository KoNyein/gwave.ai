"use client";

import * as React from "react";
import {
  Bug,
  CalendarDays,
  Droplets,
  FlaskConical,
  RotateCcw,
  Scissors,
  Sprout,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Grow Master — a turn-based cannabis-cultivation sim for verified adults.
// Keep every plant's water and nutrients inside the healthy band, deal with
// pests, and advance days until flower. Sloppy care costs plant health, and
// health decides the final yield — the same "stay in range" idea as the real
// EC/VPD tools under /tools.

type Stage = "empty" | "seed" | "seedling" | "veg" | "flower" | "ready";

const STAGE_EMOJI: Record<Stage, string> = {
  empty: "🕳️",
  seed: "🌰",
  seedling: "🌱",
  veg: "🌿",
  flower: "🌸",
  ready: "🥦",
};

const STAGE_LABEL: Record<Stage, string> = {
  empty: "Empty pot",
  seed: "Seed",
  seedling: "Seedling",
  veg: "Vegetative",
  flower: "Flowering",
  ready: "Ready!",
};

/** Good days required to leave each stage. */
const STAGE_DAYS: Partial<Record<Stage, number>> = {
  seed: 1,
  seedling: 2,
  veg: 3,
  flower: 4,
};

const NEXT_STAGE: Partial<Record<Stage, Stage>> = {
  seed: "seedling",
  seedling: "veg",
  veg: "flower",
  flower: "ready",
};

const WATER_OK: [number, number] = [30, 85];
const FEED_OK: [number, number] = [25, 75];
const PLOTS = 4;

interface Plot {
  stage: Stage;
  water: number;
  nutrients: number;
  health: number;
  pest: boolean;
  goodDays: number;
}

type Tool = "seed" | "water" | "feed" | "spray" | "harvest";

const EMPTY_PLOT: Plot = {
  stage: "empty",
  water: 0,
  nutrients: 0,
  health: 100,
  pest: false,
  goodDays: 0,
};

function freshPlots(): Plot[] {
  return Array.from({ length: PLOTS }, () => ({ ...EMPTY_PLOT }));
}

function inRange(value: number, [lo, hi]: [number, number]) {
  return value >= lo && value <= hi;
}

function Meter({
  label,
  value,
  ok,
}: {
  label: string;
  value: number;
  ok: boolean;
}) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            ok ? "bg-primary" : "bg-destructive",
          )}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function GrowGame() {
  const [plots, setPlots] = React.useState<Plot[]>(freshPlots);
  const [tool, setTool] = React.useState<Tool>("seed");
  const [day, setDay] = React.useState(1);
  const [harvested, setHarvested] = React.useState(0); // grams
  const [harvestCount, setHarvestCount] = React.useState(0);
  const [log, setLog] = React.useState<string[]>([
    "Plant a seed in every pot, keep water and nutrients in the green band, then press Next day.",
  ]);

  const done = harvestCount >= PLOTS;

  // All game logic reads current state and sets plain values — no side
  // effects inside functional updaters (StrictMode double-invokes those).
  function applyTool(index: number) {
    if (done) return;
    const plot = plots[index];
    if (!plot) return;
    const messages: string[] = [];
    let next = plot;

    switch (tool) {
      case "seed":
        if (plot.stage !== "empty") return;
        next = { ...EMPTY_PLOT, stage: "seed", water: 50, nutrients: 40 };
        messages.push(`Pot ${index + 1}: seed planted. Keep it watered!`);
        break;
      case "water":
        if (plot.stage === "empty" || plot.stage === "ready") return;
        next = { ...plot, water: Math.min(100, plot.water + 30) };
        if (next.water > WATER_OK[1])
          messages.push(
            `Pot ${index + 1}: careful — overwatering causes root rot.`,
          );
        break;
      case "feed":
        if (plot.stage === "empty" || plot.stage === "ready") return;
        next = { ...plot, nutrients: Math.min(100, plot.nutrients + 25) };
        if (next.nutrients > FEED_OK[1])
          messages.push(
            `Pot ${index + 1}: too many nutrients burns the leaves.`,
          );
        break;
      case "spray":
        if (!plot.pest) return;
        next = { ...plot, pest: false };
        messages.push(`Pot ${index + 1}: pests cleared. 🐞→🚫`);
        break;
      case "harvest": {
        if (plot.stage !== "ready") return;
        const grams = Math.round(20 + (plot.health / 100) * 40);
        setHarvested(harvested + grams);
        setHarvestCount(harvestCount + 1);
        messages.push(
          `Pot ${index + 1}: harvested ${grams} g at ${plot.health}% health! ✂️`,
        );
        next = { ...EMPTY_PLOT };
        break;
      }
    }

    setPlots(plots.map((p, i) => (i === index ? next : p)));
    if (messages.length) setLog((prev) => [...messages, ...prev].slice(0, 4));
  }

  function nextDay() {
    if (done) return;
    const messages: string[] = [];

    const nextPlots = plots.map((plot, i) => {
      if (plot.stage === "empty" || plot.stage === "ready") return plot;
      const next = { ...plot };

      // Daily consumption.
      next.water = Math.max(0, next.water - 20);
      next.nutrients = Math.max(0, next.nutrients - 12);

      // Random pest pressure.
      if (!next.pest && Math.random() < 0.12) {
        next.pest = true;
        messages.push(`Pot ${i + 1}: pests spotted! Spray before they spread. 🐛`);
      }

      // Health accounting.
      const waterOk = inRange(next.water, WATER_OK);
      const feedOk = inRange(next.nutrients, FEED_OK);
      if (next.water > 90) next.health -= 8; // root rot
      else if (next.water < 15) next.health -= 12; // drought
      if (next.nutrients > 85) next.health -= 6; // nutrient burn
      if (next.pest) next.health -= 15;

      if (waterOk && feedOk && !next.pest) {
        next.goodDays += 1;
        next.health = Math.min(100, next.health + 2);
        const needed = STAGE_DAYS[next.stage];
        const upgraded = NEXT_STAGE[next.stage];
        if (needed !== undefined && upgraded && next.goodDays >= needed) {
          next.stage = upgraded;
          next.goodDays = 0;
          messages.push(
            upgraded === "ready"
              ? `Pot ${i + 1}: buds are ready — harvest! 🥦`
              : `Pot ${i + 1}: advanced to ${STAGE_LABEL[upgraded]}.`,
          );
        }
      }

      if (next.health <= 0) {
        messages.push(`Pot ${i + 1}: the plant died. Replant and try again. 💀`);
        return { ...EMPTY_PLOT };
      }
      return next;
    });

    setDay(day + 1);
    setPlots(nextPlots);
    if (messages.length) setLog((prev) => [...messages, ...prev].slice(0, 4));
  }

  function reset() {
    setPlots(freshPlots());
    setTool("seed");
    setDay(1);
    setHarvested(0);
    setHarvestCount(0);
    setLog(["New grow started. Plant your seeds!"]);
  }

  const tools: { id: Tool; label: string; icon: typeof Sprout }[] = [
    { id: "seed", label: "Plant", icon: Sprout },
    { id: "water", label: "Water", icon: Droplets },
    { id: "feed", label: "Feed", icon: FlaskConical },
    { id: "spray", label: "Spray", icon: Bug },
    { id: "harvest", label: "Harvest", icon: Scissors },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* HUD */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-1 font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" /> Day {day}
          </span>
          <span className="flex items-center gap-1 font-semibold text-primary">
            <Trophy className="h-4 w-4" /> {harvested} g harvested (
            {harvestCount}/{PLOTS})
          </span>
        </div>

        {/* Tools */}
        <div className="flex flex-wrap gap-2">
          {tools.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              size="sm"
              variant={tool === id ? "default" : "outline"}
              onClick={() => setTool(id)}
            >
              <Icon className="mr-1 h-4 w-4" /> {label}
            </Button>
          ))}
        </div>

        {/* Plots */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {plots.map((plot, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyTool(i)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-transform active:scale-95",
                plot.stage === "ready"
                  ? "border-primary bg-primary/10"
                  : plot.stage === "empty"
                    ? "border-dashed hover:bg-muted"
                    : "hover:bg-muted",
              )}
              aria-label={`Pot ${i + 1}: ${STAGE_LABEL[plot.stage]}`}
            >
              <span className="relative text-4xl" aria-hidden>
                {STAGE_EMOJI[plot.stage]}
                {plot.pest ? (
                  <span className="absolute -right-3 -top-1 text-base">🐛</span>
                ) : null}
              </span>
              <span className="text-xs font-medium">
                {STAGE_LABEL[plot.stage]}
              </span>
              {plot.stage !== "empty" && plot.stage !== "ready" ? (
                <div className="w-full space-y-1">
                  <Meter
                    label="💧 Water"
                    value={plot.water}
                    ok={inRange(plot.water, WATER_OK)}
                  />
                  <Meter
                    label="🧪 Feed"
                    value={plot.nutrients}
                    ok={inRange(plot.nutrients, FEED_OK)}
                  />
                  <Meter
                    label="❤️ Health"
                    value={plot.health}
                    ok={plot.health >= 50}
                  />
                </div>
              ) : null}
            </button>
          ))}
        </div>

        {/* Log */}
        <div className="space-y-1 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
          {log.map((line, i) => (
            <p key={i} className={cn(i === 0 && "font-medium text-foreground")}>
              {line}
            </p>
          ))}
        </div>

        {done ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-secondary p-3">
            <p className="flex items-center gap-2 font-semibold">
              <Trophy className="h-5 w-5 text-primary" /> Grow complete —{" "}
              {harvested} g total! 🎉
            </p>
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="mr-1 h-4 w-4" /> Grow again
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={nextDay}>
              <CalendarDays className="mr-1 h-4 w-4" /> Next day
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reset
            </Button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Healthy band: water {WATER_OK[0]}–{WATER_OK[1]}%, nutrients{" "}
          {FEED_OK[0]}–{FEED_OK[1]}%. Only good days (everything in range, no
          pests) advance the plant — and final health decides your yield, just
          like keeping EC and VPD dialed in on a real grow.
        </p>
      </CardContent>
    </Card>
  );
}
