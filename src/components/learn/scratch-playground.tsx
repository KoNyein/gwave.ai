"use client";

// A self-contained, Scratch-style block-coding playground. No external
// libraries, no CDN, no server round-trip: blocks are plain data, the runtime
// is a small async interpreter, and the stage is a single <canvas>. Burmese is
// the primary UI language (with an English gloss), matching the /learn kids
// audience. State persists per-lesson through the shared autosave hook.

import * as React from "react";
import { Grid3x3, Play, RotateCcw, Square, Trash2 } from "lucide-react";

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

type Category = "motion" | "looks" | "sound" | "pen" | "control" | "data";

interface BlockDef {
  kind: string;
  my: string; // Burmese label with a {arg} placeholder
  en: string;
  category: Category;
  arg?: { kind: "number" | "text"; default: string | number };
  open?: boolean; // starts a C-block (repeat / forever / if)
  mid?: boolean; // "else" divider inside an if block
  close?: boolean; // closes a C-block
}

const BLOCK_DEFS: BlockDef[] = [
  // Motion — အလှုပ်ရှား
  { kind: "move", my: "{arg} ခြေလှမ်း ရှေ့သွား", en: "move {arg} steps", category: "motion", arg: { kind: "number", default: 40 } },
  { kind: "turnRight", my: "ညာဘက် {arg}° လှည့်", en: "turn right {arg}°", category: "motion", arg: { kind: "number", default: 90 } },
  { kind: "turnLeft", my: "ဘယ်ဘက် {arg}° လှည့်", en: "turn left {arg}°", category: "motion", arg: { kind: "number", default: 90 } },
  { kind: "goCenter", my: "အလယ်ကို ပြန်သွား", en: "go to center", category: "motion" },
  { kind: "goRandom", my: "ကျပန်း နေရာ ခုန်", en: "go to random", category: "motion" },
  // Looks — ပုံပန်း
  { kind: "say", my: "«{arg}» ဟုပြော", en: "say “{arg}”", category: "looks", arg: { kind: "text", default: "မင်္ဂလာပါ" } },
  { kind: "grow", my: "အရွယ် ကြီးလာ", en: "grow bigger", category: "looks" },
  { kind: "shrink", my: "အရွယ် ငယ်သွား", en: "shrink", category: "looks" },
  // Sound — အသံ
  { kind: "beep", my: "🔊 အသံ မြည်", en: "play beep", category: "sound" },
  { kind: "meow", my: "🐱 မြည်သံ (နှစ်သံ)", en: "play meow", category: "sound" },
  // Pen — ခဲတံ
  { kind: "penDown", my: "ခဲတံ ချ (ရေးမည်)", en: "pen down", category: "pen" },
  { kind: "penUp", my: "ခဲတံ မ (မရေး)", en: "pen up", category: "pen" },
  { kind: "penColor", my: "ခဲတံ အရောင် ပြောင်း", en: "next pen color", category: "pen" },
  // Control — ထိန်းချုပ်
  { kind: "wait", my: "{arg} စက္ကန့် စောင့်", en: "wait {arg} sec", category: "control", arg: { kind: "number", default: 1 } },
  { kind: "repeat", my: "{arg} ကြိမ် ထပ်လုပ်", en: "repeat {arg}", category: "control", arg: { kind: "number", default: 4 }, open: true },
  { kind: "forever", my: "အမြဲ ထပ်လုပ်", en: "forever", category: "control", open: true },
  { kind: "ifEdge", my: "အနား ထိရင်…", en: "if touching edge", category: "control", open: true },
  { kind: "ifBig", my: "ကိန်း > {arg} ဆိုရင်…", en: "if counter > {arg}", category: "control", arg: { kind: "number", default: 3 }, open: true },
  { kind: "elseMark", my: "မဟုတ်ရင် (else)", en: "else", category: "control", mid: true },
  { kind: "repeatEnd", my: "ဆုံး (end)", en: "end", category: "control", close: true },
  // Data — ကိန်းရှင် & စာရင်း (variables & lists / arrays)
  { kind: "setVar", my: "ကိန်း ကို {arg} ထား", en: "set counter to {arg}", category: "data", arg: { kind: "number", default: 0 } },
  { kind: "changeVar", my: "ကိန်း ကို {arg} ပေါင်း", en: "change counter by {arg}", category: "data", arg: { kind: "number", default: 1 } },
  { kind: "sayVar", my: "ကိန်း တန်ဖိုး ပြော", en: "say counter", category: "data" },
  { kind: "listAdd", my: "စာရင်းထဲ «{arg}» ထည့်", en: "add {arg} to list", category: "data", arg: { kind: "text", default: "🍎" } },
  { kind: "listClear", my: "စာရင်း ရှင်း", en: "clear list", category: "data" },
  { kind: "listSay", my: "စာရင်း တစ်ခုလုံး ပြော", en: "say list", category: "data" },
];

const DEF_BY_KIND = new Map(BLOCK_DEFS.map((d) => [d.kind, d]));

const CATEGORY_LABEL: Record<Category, string> = {
  motion: "အလှုပ်ရှား · Motion",
  looks: "ပုံပန်း · Looks",
  sound: "အသံ · Sound",
  pen: "ခဲတံ · Pen",
  control: "ထိန်းချုပ် · Control",
  data: "ကိန်းရှင် & စာရင်း · Data",
};

const CATEGORY_CLASS: Record<Category, string> = {
  motion: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
  looks: "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300",
  sound: "bg-pink-500/15 border-pink-500/40 text-pink-700 dark:text-pink-300",
  pen: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  control: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
  data: "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300",
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

// ── Sprites & backdrops ──────────────────────────────────────────────────────
// A rich set of characters the learner can pick for their sprite, grouped so
// the picker stays tidy. Any single emoji works — it's drawn on the canvas.

interface SpriteGroup {
  label: string;
  emojis: string[];
}

const SPRITE_GROUPS: SpriteGroup[] = [
  {
    label: "တိရစ္ဆာန် · Animals",
    emojis: ["🐱", "🐶", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🐔", "🐧", "🐦", "🦄", "🐝", "🐢", "🐙", "🦋", "🐬", "🐳", "🦖"],
  },
  {
    label: "လူ · People",
    emojis: ["🧑", "👦", "👧", "👶", "👨‍🚀", "👩‍🚀", "🧙", "🧚", "🦸", "🦹", "👽", "🤖", "🎅", "🧑‍🌾", "👮", "🧑‍🍳"],
  },
  {
    label: "အရာဝတ္ထု · Things",
    emojis: ["⚽", "🏀", "🎈", "🚗", "🚀", "✈️", "🚲", "⭐", "❤️", "🍎", "🍕", "🎁", "🌸", "🌳", "☀️", "🌙", "⚡", "💎"],
  },
];

const ALL_SPRITES = SPRITE_GROUPS.flatMap((g) => g.emojis);
const DEFAULT_SPRITE = "🐱";

interface Backdrop {
  id: string;
  label: string;
  css: string; // canvas fillStyle (solid or gradient handled specially)
}

const BACKDROPS: Backdrop[] = [
  { id: "white", label: "အဖြူ", css: "#ffffff" },
  { id: "sky", label: "ကောင်းကင်", css: "#dbeafe" },
  { id: "grass", label: "မြက်ခင်း", css: "#dcfce7" },
  { id: "sunset", label: "နေဝင်", css: "#fee2e2" },
  { id: "night", label: "ညအချိန်", css: "#1e293b" },
  { id: "sand", label: "သဲသောင်", css: "#fef9c3" },
];

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
  const saved = lesson?.initialData as
    | { blocks?: ScratchBlockSpec[]; sprite?: string; backdrop?: string }
    | undefined;
  const initialBlocks = React.useMemo<Block[]>(() => {
    if (saved?.blocks?.length) return saved.blocks.map(specToBlock);
    if (config?.starter?.length) return config.starter.map(specToBlock);
    return [];
  }, [saved, config]);

  const [blocks, setBlocks] = React.useState<Block[]>(initialBlocks);
  const [sprite, setSprite] = React.useState<string>(
    saved?.sprite && ALL_SPRITES.includes(saved.sprite) ? saved.sprite : DEFAULT_SPRITE,
  );
  const [backdrop, setBackdrop] = React.useState<string>(
    saved?.backdrop && BACKDROPS.some((b) => b.id === saved.backdrop)
      ? saved.backdrop
      : "white",
  );
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");
  const [done, setDone] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);
  const [speed, setSpeed] = React.useState<Speed>("normal");
  const audioRef = React.useRef<AudioContext | null>(null);

  // A short beep via Web Audio — used by the sound blocks. Best-effort: if the
  // browser blocks audio it simply stays silent.
  const playTone = React.useCallback((freq: number, dur: number) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = (audioRef.current ??= new Ctx());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      /* ignore */
    }
  }, []);
  // Live variable + list values shown in the data monitor while a run plays.
  const [monitor, setMonitor] = React.useState<{ counter: number; list: string[] } | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const penCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const cancelRef = React.useRef(false);
  // Keep the current sprite/backdrop in refs so drawSprite stays stable while
  // an animation runs (its deps don't churn on every re-render).
  const spriteRef = React.useRef(sprite);
  spriteRef.current = sprite;
  const backdropRef = React.useRef(backdrop);
  backdropRef.current = backdrop;
  const gridRef = React.useRef(showGrid);
  gridRef.current = showGrid;

  // Persist the block list + chosen sprite/backdrop per lesson.
  useProjectAutosave(
    lesson,
    "scratch",
    title,
    {
      blocks: blocks.map((b) =>
        b.arg !== undefined ? { kind: b.kind, arg: b.arg } : { kind: b.kind },
      ),
      sprite,
      backdrop,
    },
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
    setMonitor(null);
    resetStage();
  };

  // Indentation depth for each row (repeat opens, repeatEnd closes).
  const depths = React.useMemo(() => {
    let depth = 0;
    return blocks.map((b) => {
      const def = DEF_BY_KIND.get(b.kind);
      if (def?.close || def?.mid) depth = Math.max(0, depth - 1);
      const here = depth;
      if (def?.open || def?.mid) depth += 1;
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
    // Backdrop fill.
    const bd = BACKDROPS.find((b) => b.id === backdropRef.current);
    const dark = bd?.id === "night";
    if (bd && bd.id !== "white") {
      ctx.fillStyle = bd.css;
      ctx.fillRect(0, 0, STAGE, STAGE);
    }
    // Grid (ကျားကွက်) — a light coordinate board so movement is easy to read.
    if (gridRef.current) {
      const step = STAGE / 10; // 10×10 board
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)";
      ctx.beginPath();
      for (let i = 1; i < 10; i++) {
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step, STAGE);
        ctx.moveTo(0, i * step);
        ctx.lineTo(STAGE, i * step);
      }
      ctx.stroke();
      // Bolder centre cross-hair (the 0,0 origin).
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.25)";
      ctx.beginPath();
      ctx.moveTo(CENTER, 0);
      ctx.lineTo(CENTER, STAGE);
      ctx.moveTo(0, CENTER);
      ctx.lineTo(STAGE, CENTER);
      ctx.stroke();
    }
    // Pen trails on top of the backdrop.
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
    // The chosen sprite, rotated to face its direction.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(((90 - s.dir) * Math.PI) / 180);
    ctx.font = `${Math.round(30 * s.size)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(spriteRef.current, 0, 0);
    ctx.restore();
  }, [config]);

  // Redraw the initial frame whenever the sprite or backdrop changes (only
  // while idle — a run repaints every frame anyway).
  React.useEffect(() => {
    if (!running) drawSprite(INITIAL_SPRITE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprite, backdrop, showGrid]);

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
    const stepDelay = SPEED_DELAY[speed] ?? 280;

    // Variable + list runtime (Scratch "Variables / Lists").
    let counter = 0;
    const list: string[] = [];
    const syncMonitor = () => setMonitor({ counter, list: [...list] });
    setMonitor(null);

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

    // A condition slot for the if blocks (evaluated live at runtime).
    const evalCond = (kind: string, arg: string | number | undefined): boolean => {
      if (kind === "ifEdge") {
        return Math.abs(s.x) >= CENTER - 30 || Math.abs(s.y) >= CENTER - 30;
      }
      if (kind === "ifBig") return counter > clampNum(arg, 3);
      return false;
    };

    // A single leaf instruction.
    const execOp = async (kind: string, arg: string | number | undefined) => {
      switch (kind) {
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
        case "goRandom":
          s.x = Math.round((Math.random() * 2 - 1) * (CENTER - 20));
          s.y = Math.round((Math.random() * 2 - 1) * (CENTER - 20));
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
        case "beep":
          playTone(600, 0.15);
          break;
        case "meow":
          playTone(520, 0.12);
          window.setTimeout(() => playTone(380, 0.14), 130);
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
        case "setVar":
          counter = clampNum(arg, 0);
          syncMonitor();
          break;
        case "changeVar":
          counter += clampNum(arg, 1);
          syncMonitor();
          break;
        case "sayVar":
          s.say = String(counter);
          break;
        case "listAdd":
          if (list.length < 50) list.push(String(arg ?? ""));
          syncMonitor();
          break;
        case "listClear":
          list.length = 0;
          syncMonitor();
          break;
        case "listSay":
          s.say = list.length ? list.join(" ") : "(စာရင်း ဗလာ)";
          break;
        case "wait":
          drawSprite(s);
          await sleep(Math.min(3000, Math.max(0, clampNum(arg, 1)) * 1000));
          return;
        default:
          break;
      }
      drawSprite(s);
      await sleep(stepDelay);
    };

    // Recursively execute a parsed block tree (supports repeat / forever loops
    // and live if / else branching). A shared op budget prevents runaways.
    let opCount = 0;
    const MAX_OPS = 4000;
    const runNodes = async (nodes: ScratchNode[]): Promise<void> => {
      for (const node of nodes) {
        if (cancelRef.current || opCount > MAX_OPS) return;
        opCount++;
        if (node.type === "op") {
          usedKinds.add(node.kind);
          await execOp(node.kind, node.arg);
        } else if (node.type === "repeat") {
          usedKinds.add("repeat");
          const t = Math.max(0, Math.min(100, Math.round(clampNum(node.arg, 4))));
          for (let i = 0; i < t; i++) {
            if (cancelRef.current || opCount > MAX_OPS) break;
            await runNodes(node.body);
          }
        } else if (node.type === "forever") {
          usedKinds.add("forever");
          let r = 0;
          while (!cancelRef.current && opCount < MAX_OPS && r < FOREVER_ROUNDS) {
            await runNodes(node.body);
            r++;
          }
        } else {
          usedKinds.add(node.kind);
          usedKinds.add("if");
          if (evalCond(node.kind, node.arg)) await runNodes(node.body);
          else if (node.elseBody) await runNodes(node.elseBody);
        }
      }
    };

    await runNodes(parse(blocks));

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
            {(["motion", "looks", "sound", "pen", "control", "data"] as Category[]).map((cat) => (
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
            <Button
              size="sm"
              variant={showGrid ? "secondary" : "outline"}
              onClick={() => setShowGrid((v) => !v)}
              disabled={running}
            >
              <Grid3x3 className="mr-1 h-4 w-4" /> ကျားကွက်
            </Button>
            <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              ⏩
              <select
                value={speed}
                onChange={(e) => setSpeed(e.target.value as Speed)}
                disabled={running}
                className="rounded border bg-background px-1 py-1 text-foreground disabled:opacity-50"
              >
                <option value="slow">နှေး</option>
                <option value="normal">ပုံမှန်</option>
                <option value="fast">မြန်</option>
              </select>
            </label>
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
            🎭 ဇာတ်ခုံ — {sprite} ဇာတ်ကောင် ဒီမှာ ကပြပါလိမ့်မယ်
          </p>

          {/* Data monitor (variable + list) */}
          {monitor ? (
            <div className="space-y-1 rounded-lg border bg-card p-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-medium text-rose-700 dark:text-rose-300">
                  ကိန်း (counter)
                </span>
                <span className="font-mono font-semibold">{monitor.counter}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-medium text-rose-700 dark:text-rose-300">
                  စာရင်း (list)
                </span>
                <span className="flex flex-wrap gap-1">
                  {monitor.list.length ? (
                    monitor.list.map((item, i) => (
                      <span key={i} className="rounded bg-muted px-1.5 py-0.5">
                        {i + 1}. {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">(ဗလာ)</span>
                  )}
                </span>
              </div>
            </div>
          ) : null}

          {/* Sprite chooser */}
          <div className="rounded-xl border bg-card p-2">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={running}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm font-medium disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">{sprite}</span>
                🎭 ဇာတ်ကောင် ရွေးရန် · Sprite
              </span>
              <span className="text-xs text-muted-foreground">
                {pickerOpen ? "▲ ပိတ်" : "▼ ဖွင့်"}
              </span>
            </button>
            {pickerOpen ? (
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                {SPRITE_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-8 gap-1">
                      {group.emojis.map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          disabled={running}
                          onClick={() => setSprite(emo)}
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-md border text-lg transition hover:bg-muted disabled:opacity-50",
                            sprite === emo
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-transparent",
                          )}
                          aria-label={`sprite ${emo}`}
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Backdrop chooser */}
                <div className="space-y-1 border-t pt-2">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    🖼️ နောက်ခံ · Backdrop
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {BACKDROPS.map((bd) => (
                      <button
                        key={bd.id}
                        type="button"
                        disabled={running}
                        onClick={() => setBackdrop(bd.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition hover:bg-muted disabled:opacity-50",
                          backdrop === bd.id
                            ? "border-primary ring-1 ring-primary"
                            : "border-input",
                        )}
                      >
                        <span
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: bd.css }}
                        />
                        {bd.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// "forever" can't loop endlessly in an offline runtime, so it runs a generous
// but bounded number of rounds.
const FOREVER_ROUNDS = 20;

type Speed = "slow" | "normal" | "fast";
const SPEED_DELAY: Record<Speed, number> = { slow: 460, normal: 280, fast: 130 };

// The parsed program tree the interpreter walks.
type ScratchNode =
  | { type: "op"; kind: string; arg?: string | number }
  | { type: "repeat"; arg?: string | number; body: ScratchNode[] }
  | { type: "forever"; body: ScratchNode[] }
  | { type: "if"; kind: string; arg?: string | number; body: ScratchNode[]; elseBody?: ScratchNode[] };

// Parse the flat block list (with open / else / close markers) into a tree.
// Unmatched markers are tolerated so a half-built script still runs.
function parse(blocks: Block[]): ScratchNode[] {
  const root: ScratchNode[] = [];
  interface Frame {
    node: Extract<ScratchNode, { body: ScratchNode[] }>;
    arm: "body" | "else";
  }
  const stack: Frame[] = [];
  const target = (): ScratchNode[] => {
    if (!stack.length) return root;
    const f = stack[stack.length - 1]!;
    if (f.arm === "else" && f.node.type === "if") {
      return (f.node.elseBody ??= []);
    }
    return f.node.body;
  };

  for (const b of blocks) {
    const def = DEF_BY_KIND.get(b.kind);
    if (def?.open) {
      let node: Extract<ScratchNode, { body: ScratchNode[] }>;
      if (b.kind === "repeat") node = { type: "repeat", arg: b.arg, body: [] };
      else if (b.kind === "forever") node = { type: "forever", body: [] };
      else node = { type: "if", kind: b.kind, arg: b.arg, body: [] };
      target().push(node);
      stack.push({ node, arm: "body" });
    } else if (def?.mid) {
      const f = stack[stack.length - 1];
      if (f && f.node.type === "if") {
        f.arm = "else";
        f.node.elseBody ??= [];
      }
    } else if (def?.close) {
      stack.pop();
    } else {
      target().push({ type: "op", kind: b.kind, arg: b.arg });
    }
  }
  return root;
}

function clampNum(v: string | number | undefined, fallback: number): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function clampCoord(v: number): number {
  return Math.max(-CENTER + 10, Math.min(CENTER - 10, v));
}
