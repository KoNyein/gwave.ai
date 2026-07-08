"use client";

import * as React from "react";
import {
  ArrowUp,
  Flag,
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  reportLessonComplete,
  useProjectAutosave,
  type LessonRef,
} from "@/components/learn/use-learn-progress";
import { cn } from "@/lib/utils";

// Program-a-Robot: the learner builds a command sequence (forward / turn) to
// drive the robot across a grid to the flag, avoiding rocks. Teaches
// sequencing and directional logic — core robotics-education ideas. Pure
// client state, no network.

type Cmd = "forward" | "left" | "right";
type Dir = 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left
const GRID = 5;
const START = { x: 0, y: 4, dir: 1 as Dir };
const GOAL = { x: 4, y: 0 };
const ROCKS = new Set(["2,3", "2,2", "3,1"]);
const ARROWS = ["↑", "→", "↓", "←"];

function restoreProgram(
  saved: Record<string, unknown> | null | undefined,
): Cmd[] {
  if (saved && Array.isArray(saved.program)) {
    return saved.program.filter(
      (cmd): cmd is Cmd =>
        cmd === "forward" || cmd === "left" || cmd === "right",
    );
  }
  return [];
}

export function RobotGame({ lesson }: { lesson?: LessonRef }) {
  const [program, setProgram] = React.useState<Cmd[]>(() =>
    restoreProgram(lesson?.initialData),
  );
  const [pos, setPos] = React.useState(START);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<"win" | "crash" | null>(null);

  useProjectAutosave(lesson, "robot", "My robot program", { program });

  function add(cmd: Cmd) {
    if (running) return;
    setResult(null);
    setProgram((p) => (p.length < 12 ? [...p, cmd] : p));
  }

  function reset() {
    setRunning(false);
    setProgram([]);
    setPos(START);
    setResult(null);
  }

  async function run() {
    if (running || program.length === 0) return;
    setRunning(true);
    setResult(null);
    let cur = { ...START };
    setPos(cur);
    await sleep(300);

    for (const cmd of program) {
      if (cmd === "left") cur = { ...cur, dir: ((cur.dir + 3) % 4) as Dir };
      else if (cmd === "right") cur = { ...cur, dir: ((cur.dir + 1) % 4) as Dir };
      else {
        const delta: Record<Dir, [number, number]> = {
          0: [0, -1],
          1: [1, 0],
          2: [0, 1],
          3: [-1, 0],
        };
        const [dx, dy] = delta[cur.dir];
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        // Off the grid or into a rock = crash.
        if (
          nx < 0 ||
          ny < 0 ||
          nx >= GRID ||
          ny >= GRID ||
          ROCKS.has(`${nx},${ny}`)
        ) {
          setResult("crash");
          setRunning(false);
          return;
        }
        cur = { ...cur, x: nx, y: ny };
      }
      setPos(cur);
      await sleep(400);
      if (cur.x === GOAL.x && cur.y === GOAL.y) {
        setResult("win");
        setRunning(false);
        reportLessonComplete(lesson);
        return;
      }
    }
    const won = cur.x === GOAL.x && cur.y === GOAL.y;
    setResult(won ? "win" : "crash");
    setRunning(false);
    if (won) reportLessonComplete(lesson);
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="text-xs text-muted-foreground">
          Build a program to drive the robot 🤖 to the flag 🚩. Avoid the rocks
          🪨. Add commands, then press <strong>Run</strong> — the robot follows
          them in order.
        </p>

        {/* Grid */}
        <div
          className="mx-auto grid w-fit gap-1"
          style={{ gridTemplateColumns: `repeat(${GRID}, 2.5rem)` }}
        >
          {Array.from({ length: GRID * GRID }, (_, i) => {
            const x = i % GRID;
            const y = Math.floor(i / GRID);
            const isRobot = pos.x === x && pos.y === y;
            const isGoal = GOAL.x === x && GOAL.y === y;
            const isRock = ROCKS.has(`${x},${y}`);
            return (
              <div
                key={i}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md border text-lg",
                  isGoal && "bg-primary/10",
                  isRock && "bg-muted",
                )}
              >
                {isRobot ? (
                  <span title={`facing ${ARROWS[pos.dir]}`}>
                    🤖<span className="text-[10px]">{ARROWS[pos.dir]}</span>
                  </span>
                ) : isGoal ? (
                  "🚩"
                ) : isRock ? (
                  "🪨"
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Program strip */}
        <div className="min-h-8 flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-2">
          {program.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Your program is empty — add commands below.
            </span>
          ) : (
            program.map((cmd, i) => (
              <span
                key={i}
                className="flex h-7 w-7 items-center justify-center rounded bg-background text-sm shadow-sm"
              >
                {cmd === "forward" ? "↑" : cmd === "left" ? "↺" : "↻"}
              </span>
            ))
          )}
        </div>

        {/* Command buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => add("forward")}>
            <ArrowUp className="mr-1 h-4 w-4" /> Forward
          </Button>
          <Button size="sm" variant="outline" onClick={() => add("left")}>
            <RotateCcw className="mr-1 h-4 w-4" /> Turn left
          </Button>
          <Button size="sm" variant="outline" onClick={() => add("right")}>
            <RotateCw className="mr-1 h-4 w-4" /> Turn right
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button size="sm" onClick={run} disabled={running || !program.length}>
              <Play className="mr-1 h-4 w-4" /> Run
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={running}>
              <Trash2 className="mr-1 h-4 w-4" /> Clear
            </Button>
          </div>
          {result === "win" && (
            <span className="flex items-center gap-1 text-sm font-semibold text-primary">
              <Flag className="h-4 w-4" /> Reached the goal! 🎉
            </span>
          )}
          {result === "crash" && (
            <span className="text-sm font-semibold text-destructive">
              Crashed or missed — adjust your program and try again.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
