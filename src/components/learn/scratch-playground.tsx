"use client";

// A self-contained, Scratch-style block-coding playground. No external
// libraries, no CDN, no server round-trip: blocks are plain data, the runtime
// is a small async interpreter, and the stage is a single <canvas>. Burmese is
// the primary UI language (with an English gloss), matching the /learn kids
// audience. State persists per-lesson through the shared autosave hook.

import * as React from "react";
import { Play, RotateCcw, Square, Trash2 } from "lucide-react";

import {
  reportLessonComplete,
  useProjectAutosave,
  type LessonRef,
} from "@/components/learn/use-learn-progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScratchBlockSpec, ScratchConfig } from "@/lib/learn/lessons";

// ── Block catalogue ─────────────────────────────────────────────────────────
// Each block kind carries a bilingual label, a category colour and (optionally)
// a numeric/text argument with a default. `open`/`close` mark the C-shaped
// repeat block so the editor can indent and the interpreter can loop.

type Category = "motion" | "looks" | "pen" | "control";

interface BlockDef {
  kind: string;
  my: string; // Burmese label with a {arg} placeholder
  en: string;
  category: Category;
  arg?: { kind: "number" | "text"; default: string | number };
  open?: boolean; // starts a C-block (repeat)
  close?: boolean; // closes a C-block
}

const BLOCK_DEFS: BlockDef[] = [
  // Motion — အလှုပ်ရှား
  { kind: "move", my: "{arg} ခြေလှမ်း ရှေ့သွား", en: "move {arg} steps", category: "motion", arg: { kind: "number", default: 40 } },
  { kind: "turnRight", my: "ညာဘက် {arg}° လှည့်", en: "turn right {arg}°", category: "motion", arg: { kind: "number", default: 90 } },
  { kind: "turnLeft", my: "ဘယ်ဘက် {arg}° လှည့်", en: "turn left {arg}°", category: "motion", arg: { kind: "number", default: 90 } },
  { kind: "goCenter", my: "အလယ်ကို ပြန်သွား", en: "go to center", category: "motion" },
  // Looks — ပုံပန်း
  { kind: "say", my: "«{arg}» ဟုပြော", en: "say “{arg}”", category: "looks", arg: { kind: "text", default: "မင်္ဂလာပါ" } },
  { kind: "grow", my: "အရွယ် ကြီးလာ", en: "grow bigger", category: "looks" },
  { kind: "shrink", my: "အရွယ် ငယ်သွား", en: "shrink", category: "looks" },
  // Pen — ခဲတံ
  { kind: "penDown", my: "ခဲတံ ချ (ရေးမည်)", en: "pen down", category: "pen" },
  { kind: "penUp", my: "ခဲတံ မ (မရေး)", en: "pen up", category: "pen" },
  { kind: "penColor", my: "ခဲတံ အရောင် ပြောင်း", en: "next pen color", category: "pen" },
  // Control — ထိန်းချုပ်
  { kind: "wait", my: "{arg} စက္ကန့် စောင့်", en: "wait {arg} sec", category: "control", arg: { kind: "number", default: 1 } },
  { kind: "repeat", my: "{arg} ကြိမ် ထပ်လုပ်", en: "repeat {arg}", category: "control", arg: { kind: "number", default: 4 }, open: true },
  { kind: "repeatEnd", my: "ထပ်လုပ် ဆုံး", en: "end repeat", category: "control", close: true },
];

const DEF_BY_KIND = new Map(BLOCK_DEFS.map((d) => [d.kind, d]));

const CATEGORY_LABEL: Record<Category, string> = {
  motion: "အလှုပ်ရှား · Motion",
  looks: "ပုံပန်း · Looks",
  pen: "ခဲတံ · Pen",
  control: "ထိန်းချုပ် · Control",
};

const CATEGORY_CLASS: Record<Category, string> = {
  motion: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
  looks: "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300",
  pen: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  control: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
};

const PEN_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899"];

// A block placed in the script. `arg` overrides the default when present.
interface Block {
  id: string;
  kind: string;
  arg?: string | number;
}

let idCounter = 0;
const newId = () => `b${Date.now().toString(36)}${idCounter++}`;

function specToBlock(spec: ScratchBlockSpec): Block {
  return spec.arg !== undefined
    ? { id: newId(), kind: spec.kind, arg: spec.arg }
    : { id: newId(), kind: spec.kind };
}

function labelFor(block: Block): string {
  const def = DEF_BY_KIND.get(block.kind);
  if (!def) return block.kind;
  const value = block.arg ?? def.arg?.default ?? "";
  return def.my.replace("{arg}", String(value));
}

// ── Component ────────────────────────────────────────────────────────────────

const STAGE = 300; // canvas size in px (logical)
const CENTER = STAGE / 2;

interface SpriteState {
  x: number; // Scratch coords: 0,0 = centre, +x right, +y up
  y: number;
  dir: number; // 90 = right, 0 = up (degrees)
  size: number; // 1 = normal
  penDown: boolean;
  colorIndex: number;
  say: string;
}

const INITIAL_SPRITE: SpriteState = {
  x: 0,
  y: 0,
  dir: 90,
  size: 1,
  penDown: false,
  colorIndex: 1,
  say: "",
};

export function ScratchPlayground({
  config,
  lesson,
  title,
}: {
  config?: ScratchConfig;
  lesson?: LessonRef;
  title: string;
}) {
  const saved = lesson?.initialData as { blocks?: ScratchBlockSpec[] } | undefined;
  const initialBlocks = React.useMemo<Block[]>(() => {
    if (saved?.blocks?.length) return saved.blocks.map(specToBlock);
    if (config?.starter?.length) return config.starter.map(specToBlock);
    return [];
  }, [saved, config]);

  const [blocks, setBlocks] = React.useState<Block[]>(initialBlocks);
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");
  const [done, setDone] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const penCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const cancelRef = React.useRef(false);

  // Persist the block list (as plain specs) per lesson.
  useProjectAutosave(
    lesson,
    "scratch",
    title,
    { blocks: blocks.map((b) => (b.arg !== undefined ? { kind: b.kind, arg: b.arg } : { kind: b.kind })) },
    true,
  );

  // ── Editing ────────────────────────────────────────────────────────────
  const addBlock = (kind: string) => {
    if (running) return;
    setBlocks((prev) => [...prev, { id: newId(), kind }]);
    setDone(false);
  };
  const removeBlock = (id: string) => {
    if (running) return;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };
  const setArg = (id: string, value: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, arg: value } : b)),
    );
  };
  const clearAll = () => {
    if (running) return;
    setBlocks([]);
    setDone(false);
    setStatus("");
    resetStage();
  };

  // Indentation depth for each row (repeat opens, repeatEnd closes).
  const depths = React.useMemo(() => {
    let depth = 0;
    return blocks.map((b) => {
      const def = DEF_BY_KIND.get(b.kind);
      if (def?.close) depth = Math.max(0, depth - 1);
      const here = depth;
      if (def?.open) depth += 1;
      return here;
    });
  }, [blocks]);

  // ── Stage drawing ──────────────────────────────────────────────────────
  const drawSprite = React.useCallback((s: SpriteState) => {
    const canvas = canvasRef.current;
    const pen = penCanvasRef.current;
    if (!canvas || !pen) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE, STAGE);
    // Pen trails underneath.
    ctx.drawImage(pen, 0, 0);
    // Optional goal marker.
    if (config?.goal?.reach) {
      const gx = CENTER + config.goal.reach.x;
      const gy = CENTER - config.goal.reach.y;
      ctx.font = "22px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🎯", gx, gy);
    }
    // Speech bubble.
    const sx = CENTER + s.x;
    const sy = CENTER - s.y;
    if (s.say) {
      ctx.font = "12px sans-serif";
      const w = Math.min(180, ctx.measureText(s.say).width + 16);
      const bx = Math.min(STAGE - w - 2, sx + 14);
      const by = Math.max(2, sy - 34);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(bx, by, w, 24, 8);
      } else {
        ctx.rect(bx, by, w, 24);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(s.say, bx + 8, by + 12);
    }
    // Sprite (a cat) rotated to face its direction.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(((90 - s.dir) * Math.PI) / 180);
    ctx.font = `${Math.round(30 * s.size)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🐱", 0, 0);
    ctx.restore();
  }, [config]);

  const resetStage = React.useCallback(() => {
    const pen = penCanvasRef.current;
    if (pen) {
      const pctx = pen.getContext("2d");
      pctx?.clearRect(0, 0, STAGE, STAGE);
    }
    drawSprite(INITIAL_SPRITE);
  }, [drawSprite]);

  // Draw the initial frame once mounted.
  React.useEffect(() => {
    resetStage();
  }, [resetStage]);

  // ── Interpreter ────────────────────────────────────────────────────────
  const run = async () => {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    setDone(false);
    setStatus("▶️ လုပ်ဆောင်နေသည်…");

    // Reset stage + sprite.
    const pen = penCanvasRef.current;
    const pctx = pen?.getContext("2d") ?? null;
    pctx?.clearRect(0, 0, STAGE, STAGE);
    const s: SpriteState = { ...INITIAL_SPRITE };
    drawSprite(s);

    const usedKinds = new Set<string>();
    const sleep = (ms: number) =>
      new Promise<void>((res) => setTimeout(res, ms));

    // Expand into a linear op list, unrolling repeat blocks (bounded) so the
    // interpreter stays simple. Total steps are capped to avoid runaways.
    const ops = expand(blocks);
    const MAX_OPS = 2000;

    const penLine = (x0: number, y0: number, x1: number, y1: number, color: string) => {
      if (!pctx) return;
      pctx.strokeStyle = color;
      pctx.lineWidth = 3;
      pctx.lineCap = "round";
      pctx.beginPath();
      pctx.moveTo(CENTER + x0, CENTER - y0);
      pctx.lineTo(CENTER + x1, CENTER - y1);
      pctx.stroke();
    };

    let count = 0;
    for (const op of ops) {
      if (cancelRef.current) break;
      if (count++ > MAX_OPS) break;
      usedKinds.add(op.kind);
      const arg = op.arg;
      switch (op.kind) {
        case "move": {
          const steps = clampNum(arg, 40);
          const rad = (s.dir * Math.PI) / 180;
          const nx = s.x + steps * Math.sin(rad);
          const ny = s.y + steps * Math.cos(rad);
          if (s.penDown) penLine(s.x, s.y, nx, ny, PEN_COLORS[s.colorIndex] ?? "#3b82f6");
          s.x = clampCoord(nx);
          s.y = clampCoord(ny);
          break;
        }
        case "turnRight":
          s.dir = (s.dir + clampNum(arg, 90)) % 360;
          break;
        case "turnLeft":
          s.dir = (s.dir - clampNum(arg, 90) + 360) % 360;
          break;
        case "goCenter":
          s.x = 0;
          s.y = 0;
          break;
        case "say":
          s.say = String(arg ?? "");
          break;
        case "grow":
          s.size = Math.min(2.4, s.size + 0.3);
          break;
        case "shrink":
          s.size = Math.max(0.4, s.size - 0.3);
          break;
        case "penDown":
          s.penDown = true;
          break;
        case "penUp":
          s.penDown = false;
          break;
        case "penColor":
          s.colorIndex = (s.colorIndex + 1) % PEN_COLORS.length;
          break;
        case "wait":
          drawSprite(s);
          await sleep(Math.min(3000, Math.max(0, clampNum(arg, 1)) * 1000));
          continue;
        default:
          break;
      }
      drawSprite(s);
      await sleep(280);
    }

    setRunning(false);
    if (cancelRef.current) {
      setStatus("⏹️ ရပ်လိုက်ပါပြီ");
      return;
    }

    // Goal evaluation.
    const goal = config?.goal;
    let success = true;
    if (goal?.requireKinds?.length) {
      success = goal.requireKinds.every((k) => usedKinds.has(k));
    }
    if (success && goal?.reach) {
      const tol = goal.reach.tol ?? 30;
      const dist = Math.hypot(s.x - goal.reach.x, s.y - goal.reach.y);
      success = dist <= tol;
    }
    if (goal && success) {
      setDone(true);
      setStatus("🎉 အောင်မြင်ပါသည်!");
      reportLessonComplete(lesson);
    } else if (goal) {
      setStatus("ထပ်ကြိုးစားကြည့်ပါ 💪");
    } else {
      setStatus("✅ ပြီးပါပြီ");
      setDone(true);
      reportLessonComplete(lesson);
    }
  };

  const stop = () => {
    cancelRef.current = true;
    setRunning(false);
  };

  const byCategory = (c: Category) => BLOCK_DEFS.filter((d) => d.category === c);

  return (
    <div className="space-y-3">
      {config?.goal ? (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          🎯 <span className="font-medium">ရည်မှန်းချက်:</span>{" "}
          {config.goal.reach
            ? "🐱 ကြောင်လေးကို 🎯 ပစ်မှတ်ဆီ ရောက်အောင် block တွေ တပ်ပါ။"
            : config.goal.requireKinds?.length
              ? `ဒီ block တွေ သုံးပြီး program တစ်ခု ဆောက်ပါ — ${config.goal.requireKinds
                  .map((k) => DEF_BY_KIND.get(k)?.my.replace("{arg}", "…") ?? k)
                  .join("၊ ")}`
              : "block တွေ တပ်ပြီး Run နှိပ်ကြည့်ပါ။"}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        {/* Palette + script */}
        <div className="space-y-3">
          {/* Palette */}
          <div className="space-y-2 rounded-xl border bg-card p-3">
            {(["motion", "looks", "pen", "control"] as Category[]).map((cat) => (
              <div key={cat} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {CATEGORY_LABEL[cat]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {byCategory(cat).map((def) => (
                    <button
                      key={def.kind}
                      type="button"
                      disabled={running}
                      onClick={() => addBlock(def.kind)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-left text-xs font-medium transition hover:brightness-110 disabled:opacity-50",
                        CATEGORY_CLASS[cat],
                      )}
                      title={def.en}
                    >
                      {def.my.replace("{arg}", String(def.arg?.default ?? ""))}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Script */}
          <div className="space-y-1.5 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">📜 ကျွန်ုပ်၏ script</p>
              <button
                type="button"
                onClick={clearAll}
                disabled={running || blocks.length === 0}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> ရှင်း
              </button>
            </div>
            {blocks.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                အပေါ်က block တွေကို နှိပ်ပြီး ဒီနေရာမှာ program တစ်ခု တည်ဆောက်ပါ။
              </p>
            ) : (
              <ol className="space-y-1">
                {blocks.map((b, i) => {
                  const def = DEF_BY_KIND.get(b.kind);
                  const depth = depths[i] ?? 0;
                  return (
                    <li
                      key={b.id}
                      className="flex items-center gap-2"
                      style={{ paddingInlineStart: `${depth * 16}px` }}
                    >
                      <span
                        className={cn(
                          "flex flex-1 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                          CATEGORY_CLASS[def?.category ?? "control"],
                        )}
                      >
                        <span className="text-muted-foreground/70">{i + 1}.</span>
                        {def?.arg ? (
                          <>
                            <span>{def.my.split("{arg}")[0]}</span>
                            <input
                              value={String(b.arg ?? def.arg.default)}
                              onChange={(e) => setArg(b.id, e.target.value)}
                              disabled={running}
                              inputMode={def.arg.kind === "number" ? "numeric" : "text"}
                              className={cn(
                                "rounded border bg-background px-1 py-0.5 text-center text-foreground",
                                def.arg.kind === "number" ? "w-14" : "w-28",
                              )}
                            />
                            <span>{def.my.split("{arg}")[1]}</span>
                          </>
                        ) : (
                          <span>{labelFor(b)}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBlock(b.id)}
                        disabled={running}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                        aria-label="ဖျက်"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <Button size="sm" variant="destructive" onClick={stop}>
                <Square className="mr-1 h-4 w-4" /> ရပ်
              </Button>
            ) : (
              <Button size="sm" onClick={run} disabled={blocks.length === 0}>
                <Play className="mr-1 h-4 w-4" /> Run · စတင်
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={resetStage} disabled={running}>
              <RotateCcw className="mr-1 h-4 w-4" /> ဇာတ်ခုံ ရှင်း
            </Button>
            {status ? (
              <span
                className={cn(
                  "text-sm font-medium",
                  done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                {status}
              </span>
            ) : null}
          </div>
        </div>

        {/* Stage */}
        <div className="space-y-2">
          <div className="relative mx-auto w-full max-w-[320px]">
            <canvas
              ref={canvasRef}
              width={STAGE}
              height={STAGE}
              className="aspect-square w-full rounded-xl border bg-white shadow-sm"
            />
            {/* Off-screen pen layer (never displayed directly). */}
            <canvas
              ref={penCanvasRef}
              width={STAGE}
              height={STAGE}
              className="hidden"
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            🎭 ဇာတ်ခုံ — 🐱 ကြောင်လေး ဒီမှာ ကပြပါလိမ့်မယ်
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Unroll repeat/repeatEnd into a flat op list. Unmatched ends are ignored and
// open repeats are auto-closed at the tail, so a half-built script still runs.
function expand(blocks: Block[]): Block[] {
  interface Frame {
    times: number;
    body: Block[];
  }
  const root: Block[] = [];
  const stack: Frame[] = [];
  const target = () => (stack.length ? stack[stack.length - 1]!.body : root);

  for (const b of blocks) {
    const def = DEF_BY_KIND.get(b.kind);
    if (def?.open) {
      stack.push({ times: clampNum(b.arg, 4), body: [] });
    } else if (def?.close) {
      const frame = stack.pop();
      if (frame) {
        const unrolled = repeatBody(frame);
        target().push(...unrolled);
      }
    } else {
      target().push(b);
    }
  }
  // Auto-close any still-open repeats.
  while (stack.length) {
    const frame = stack.pop()!;
    const unrolled = repeatBody(frame);
    target().push(...unrolled);
  }
  return root;
}

function repeatBody(frame: { times: number; body: Block[] }): Block[] {
  const times = Math.max(0, Math.min(50, Math.round(frame.times)));
  const out: Block[] = [];
  for (let i = 0; i < times; i++) out.push(...frame.body);
  return out;
}

function clampNum(v: string | number | undefined, fallback: number): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function clampCoord(v: number): number {
  return Math.max(-CENTER + 10, Math.min(CENTER - 10, v));
}
