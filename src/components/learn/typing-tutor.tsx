"use client";

import * as React from "react";
import { Keyboard, RotateCcw, Timer, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { recordTypingScore } from "@/lib/actions/typing";
import { LANG_COURSES } from "@/lib/learn/languages";
import {
  CHALLENGE_DURATIONS,
  CHALLENGE_TEXT,
  FINGERS,
  HOME_KEYS,
  KEYBOARD_ROWS,
  KEY_FINGER,
  TYPING_LESSONS,
  fingerFor,
  keyFor,
} from "@/lib/learn/typing-tutor";
import { cn } from "@/lib/utils";

type Mode = "guide" | "practice" | "challenge";

// Practice text per language: join a course's vocabulary into typing lines.
const LANG_TEXT: { slug: string; flag: string; label: string; text: string }[] =
  LANG_COURSES.map((c) => ({
    slug: c.slug,
    flag: c.flag,
    label: c.nativeLabel,
    text: c.units
      .flatMap((u) => u.items.map((i) => i.target))
      .slice(0, 40)
      .join("  "),
  }));

export function TypingTutor({
  langSlug,
  initialBestWpm = 0,
}: {
  langSlug?: string;
  initialBestWpm?: number;
}) {
  const [mode, setMode] = React.useState<Mode>("guide");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["guide", "📖 လမ်းညွှန်"],
            ["practice", "⌨️ လေ့ကျင့်ခန်း"],
            ["challenge", "🏆 စိန်ခေါ်မှု"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              mode === m
                ? "border-primary bg-primary/10"
                : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "guide" ? <Guide /> : null}
      {mode === "practice" ? (
        <Practice langSlug={langSlug} initialBestWpm={initialBestWpm} />
      ) : null}
      {mode === "challenge" ? (
        <Challenge langSlug={langSlug} initialBestWpm={initialBestWpm} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 📖 Basic lesson: posture, home row, finger map
// ---------------------------------------------------------------------------
function Guide() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="font-semibold">🪑 မှန်ကန်သော ထိုင်နည်း</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <PostureSVG />
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• ကျောကို မတ်မတ် ထား၊ ပခုံး လျှော့ချ</li>
              <li>• တံတောင်ဆစ် ~၉၀° ကွေး၊ လက်ကောက်ဝတ် မတင်ထား</li>
              <li>• မျက်လုံးနှင့် screen အကွာအဝေး ~၅၀–၇၀ စင်တီမီတာ</li>
              <li>• ခြေဖဝါး နှစ်ဖက် ကြမ်းပြင်ပေါ် ငြိမ်ငြိမ် ချ</li>
              <li>• screen ကို ကြည့်၊ လက်ကို မကြည့် (touch typing)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="font-semibold">🖐️ Home Row နှင့် လက်ချောင်း ၉ ချောင်း</p>
          <p className="text-sm text-muted-foreground">
            လက်ချောင်းများကို <b>ASDF</b> (ဘယ်) နှင့် <b>JKL;</b> (ညာ) ပေါ်တွင်
            အနားယူထားပါ။ <b>F</b> နှင့် <b>J</b> ခလုတ်များတွင် အဖုလေးများ ရှိ၍
            လက်မကြည့်ဘဲ နေရာ ပြန်ရှာနိုင်သည်။ လက်မ နှစ်ဖက်ဖြင့် space bar ကို နှိပ်ပါ။
          </p>
          <KeyboardView nextKey={null} />
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(FINGERS).map(([id, f]) => (
              <span key={id} className="inline-flex items-center gap-1 text-xs">
                <span className={cn("h-3 w-3 rounded", f.bg)} />
                {f.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">💡 လေ့ကျင့်နည်း မူများ</p>
          <p>• အရင်ဆုံး <b>တိကျမှု</b> ကို ဦးစားပေးပါ — အလျင်က နောက်မှ လိုက်လာမည်။</p>
          <p>• မှားလျှင် ရပ်၍ မှန်အောင် ပြန်ရိုက်ပါ။ လက်ချောင်း မှန်ကန်စွာ သုံးပါ။</p>
          <p>• နေ့စဉ် ၁၀–၁၅ မိနစ် ပုံမှန် လေ့ကျင့်ခြင်းက အကောင်းဆုံး။</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PostureSVG() {
  return (
    <svg
      viewBox="0 0 200 150"
      className="h-36 w-auto shrink-0 rounded-lg border bg-background"
      role="img"
      aria-label="မှန်ကန်သော ထိုင်နည်း"
    >
      {/* floor + desk */}
      <line x1="10" y1="140" x2="190" y2="140" stroke="#94a3b8" strokeWidth="2" />
      <rect x="120" y="95" width="70" height="6" fill="#a16207" />
      <line x1="150" y1="101" x2="150" y2="140" stroke="#a16207" strokeWidth="3" />
      {/* screen */}
      <rect x="150" y="55" width="34" height="26" rx="2" fill="#0ea5e9" />
      <line x1="167" y1="81" x2="167" y2="95" stroke="#64748b" strokeWidth="2" />
      {/* chair */}
      <line x1="55" y1="110" x2="55" y2="140" stroke="#64748b" strokeWidth="3" />
      <rect x="40" y="108" width="35" height="5" fill="#64748b" />
      <line x1="40" y1="70" x2="40" y2="110" stroke="#64748b" strokeWidth="3" />
      {/* person — straight back, 90° elbow */}
      <circle cx="66" cy="55" r="9" fill="#f59e0b" />
      <line x1="66" y1="64" x2="66" y2="100" stroke="#22c55e" strokeWidth="4" />
      {/* upper + fore arm ~90° */}
      <line x1="66" y1="74" x2="90" y2="74" stroke="#16a34a" strokeWidth="3" />
      <line x1="90" y1="74" x2="120" y2="92" stroke="#16a34a" strokeWidth="3" />
      {/* thigh + shin */}
      <line x1="66" y1="100" x2="95" y2="100" stroke="#22c55e" strokeWidth="4" />
      <line x1="95" y1="100" x2="95" y2="140" stroke="#22c55e" strokeWidth="4" />
      {/* 90 label */}
      <text x="92" y="88" fontSize="8" fill="#16a34a">
        90°
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// On-screen keyboard, coloured by finger, highlighting the next key
// ---------------------------------------------------------------------------
function KeyboardView({ nextKey }: { nextKey: string | null }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="mx-auto flex min-w-[520px] flex-col items-center gap-1">
        {KEYBOARD_ROWS.map((row, r) => (
          <div key={r} className="flex gap-1" style={{ paddingLeft: r * 12 }}>
            {row.map((k) => {
              const finger = KEY_FINGER[k];
              const active = nextKey === k;
              return (
                <div
                  key={k}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded text-xs font-medium text-white/90",
                    finger ? FINGERS[finger].bg : "bg-muted-foreground",
                    active &&
                      "scale-110 ring-2 ring-offset-1 ring-foreground",
                    !active && "opacity-70",
                  )}
                >
                  {k === " " ? "" : k.toUpperCase()}
                  {HOME_KEYS.has(k) ? (
                    <span className="absolute bottom-0.5 h-0.5 w-2 rounded bg-white/80" />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        {/* space bar */}
        <div
          className={cn(
            "mt-1 flex h-8 w-64 items-center justify-center rounded text-xs text-white/90",
            FINGERS.th.bg,
            nextKey === " " && "scale-105 ring-2 ring-offset-1 ring-foreground",
            nextKey !== " " && "opacity-70",
          )}
        >
          space
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared typing engine hook
// ---------------------------------------------------------------------------
function useTyping(target: string) {
  const [typed, setTyped] = React.useState("");
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [errors, setErrors] = React.useState(0);
  const [combo, setCombo] = React.useState(0);
  const [maxCombo, setMaxCombo] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const lastLen = React.useRef(0);

  const reset = React.useCallback(() => {
    setTyped("");
    setStartedAt(null);
    setErrors(0);
    setCombo(0);
    setMaxCombo(0);
    setScore(0);
    lastLen.current = 0;
  }, []);

  const onType = React.useCallback(
    (value: string) => {
      if (startedAt === null && value.length > 0) setStartedAt(Date.now());
      // Only react to a single new character (typing forward).
      if (value.length > lastLen.current) {
        const i = value.length - 1;
        const correct = value[i] === target[i];
        if (correct) {
          setCombo((c) => {
            const nc = c + 1;
            setMaxCombo((m) => Math.max(m, nc));
            // combo tiers: every 10 in a row worth more.
            setScore((s) => s + 10 + Math.floor(nc / 10) * 5);
            return nc;
          });
        } else {
          setErrors((e) => e + 1);
          setCombo(0);
        }
      }
      lastLen.current = value.length;
      setTyped(value);
    },
    [startedAt, target],
  );

  const correctChars = React.useMemo(() => {
    let n = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) n++;
    return n;
  }, [typed, target]);

  const elapsedMin =
    startedAt !== null ? (Date.now() - startedAt) / 60000 : 0;

  return {
    typed,
    onType,
    reset,
    errors,
    combo,
    maxCombo,
    score,
    correctChars,
    startedAt,
    accuracy: typed.length ? Math.round((correctChars / typed.length) * 100) : 100,
    elapsedMin,
  };
}

function Stats({
  wpm,
  accuracy,
  combo,
  score,
}: {
  wpm: number;
  accuracy: number;
  combo: number;
  score: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        ["WPM", wpm.toString()],
        ["တိကျမှု", accuracy + "%"],
        ["Combo", "×" + combo],
        ["ရမှတ်", score.toString()],
      ].map(([label, val]) => (
        <div key={label} className="rounded-lg border p-2">
          <p className="text-lg font-bold tabular-nums">{val}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

/** Render the target text with per-character colouring + a caret. */
function TargetText({ target, typed }: { target: string; typed: string }) {
  return (
    <p className="rounded-lg border bg-muted/40 p-3 font-mono text-base leading-8 tracking-wide">
      {target.split("").map((ch, i) => {
        const done = i < typed.length;
        const ok = typed[i] === ch;
        return (
          <span
            key={i}
            className={cn(
              i === typed.length && "rounded bg-primary/30 underline",
              done && ok && "text-emerald-600",
              done && !ok && "rounded bg-destructive/20 text-destructive",
            )}
          >
            {ch}
          </span>
        );
      })}
    </p>
  );
}

// ---------------------------------------------------------------------------
// ⌨️ Practice — level lessons + language vocabulary
// ---------------------------------------------------------------------------
function Practice({
  langSlug,
  initialBestWpm,
}: {
  langSlug?: string;
  initialBestWpm: number;
}) {
  const [source, setSource] = React.useState<string>(
    langSlug ? `lang:${langSlug}` : TYPING_LESSONS[0]!.id,
  );
  const target = React.useMemo(() => {
    if (source.startsWith("lang:")) {
      const slug = source.slice(5);
      return LANG_TEXT.find((l) => l.slug === slug)?.text ?? "";
    }
    return TYPING_LESSONS.find((l) => l.id === source)?.text ?? "";
  }, [source]);

  const t = useTyping(target);
  const [best, setBest] = React.useState(initialBestWpm);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const done = t.typed.length >= target.length && target.length > 0;
  const wpm = t.elapsedMin > 0 ? Math.round(t.correctChars / 5 / t.elapsedMin) : 0;
  const nextChar = target[t.typed.length] ?? "";
  const nextKey = nextChar ? keyFor(nextChar) : null;
  const finger = nextChar ? fingerFor(nextChar) : null;

  const savedRef = React.useRef(false);
  React.useEffect(() => {
    if (done && !savedRef.current && t.startedAt) {
      savedRef.current = true;
      const langName = source.startsWith("lang:") ? source.slice(5) : "typing";
      void recordTypingScore({
        lang: langName,
        wpm,
        accuracy: t.accuracy,
        chars: target.length,
      });
      setBest((b) => Math.max(b, wpm));
    }
  }, [done, wpm, t.accuracy, t.startedAt, target.length, source]);

  function restart() {
    savedRef.current = false;
    t.reset();
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TYPING_LESSONS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              setSource(l.id);
              restart();
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              source === l.id ? "border-primary bg-primary/10" : "text-muted-foreground",
            )}
          >
            {l.title}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground">ဘာသာစကား:</span>
        {LANG_TEXT.map((l) => (
          <button
            key={l.slug}
            type="button"
            onClick={() => {
              setSource(`lang:${l.slug}`);
              restart();
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              source === `lang:${l.slug}`
                ? "border-primary bg-primary/10"
                : "text-muted-foreground",
            )}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      <Stats wpm={wpm} accuracy={t.accuracy} combo={t.combo} score={t.score} />

      <TargetText target={target} typed={t.typed} />

      {!done && finger ? (
        <p className="text-center text-sm">
          နောက်ခလုတ်: <b className="font-mono">{nextChar === " " ? "space" : nextChar}</b>{" "}
          — {FINGERS[finger].label} ဖြင့် နှိပ်ပါ
        </p>
      ) : null}

      <KeyboardView nextKey={done ? null : nextKey} />

      <input
        ref={inputRef}
        autoFocus
        value={t.typed}
        onChange={(e) => onlyForward(e.target.value, target, t.onType)}
        disabled={done}
        placeholder="ဒီနေရာကို နှိပ်ပြီး စရိုက်ပါ…"
        className="w-full rounded-lg border bg-background p-3 text-base outline-none focus:ring-2 focus:ring-ring"
      />

      {done ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
            <Trophy className="h-8 w-8 text-amber-500" />
            <p className="font-semibold">
              ✅ ပြီးပါပြီ! WPM {wpm} · တိကျမှု {t.accuracy}% · Combo ×{t.maxCombo}
            </p>
            <p className="text-xs text-muted-foreground">
              အမြင့်ဆုံး WPM: {best}
            </p>
            <Button size="sm" onClick={restart}>
              <RotateCcw className="mr-1 h-4 w-4" /> ထပ်လေ့ကျင့်
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** Ignore edits that don't simply append/trim from the end (no paste jumps). */
function onlyForward(
  value: string,
  target: string,
  onType: (v: string) => void,
) {
  if (value.length > target.length) value = value.slice(0, target.length);
  onType(value);
}

// ---------------------------------------------------------------------------
// 🏆 Challenge — timed (60/120/240/custom) with combo scoring
// ---------------------------------------------------------------------------
function Challenge({
  langSlug,
  initialBestWpm,
}: {
  langSlug?: string;
  initialBestWpm: number;
}) {
  const [duration, setDuration] = React.useState<number>(60);
  const [custom, setCustom] = React.useState("90");
  const [running, setRunning] = React.useState(false);
  const [remaining, setRemaining] = React.useState(duration);
  const [finished, setFinished] = React.useState(false);
  const target = CHALLENGE_TEXT;
  const t = useTyping(target);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const savedRef = React.useRef(false);

  const wpm = t.elapsedMin > 0 ? Math.round(t.correctChars / 5 / t.elapsedMin) : 0;
  const nextChar = target[t.typed.length] ?? "";
  const nextKey = nextChar ? keyFor(nextChar) : null;

  React.useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      setFinished(true);
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining]);

  React.useEffect(() => {
    if (finished && !savedRef.current && t.startedAt) {
      savedRef.current = true;
      void recordTypingScore({
        lang: langSlug ?? "challenge",
        wpm,
        accuracy: t.accuracy,
        chars: t.typed.length,
      });
    }
  }, [finished, wpm, t.accuracy, t.typed.length, t.startedAt, langSlug]);

  function start(secs: number) {
    setDuration(secs);
    setRemaining(secs);
    setFinished(false);
    savedRef.current = false;
    t.reset();
    setRunning(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {CHALLENGE_DURATIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => start(s)}
            className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted"
          >
            {s}s
          </button>
        ))}
        <span className="mx-1 text-xs text-muted-foreground">စိတ်ကြိုက်:</span>
        <input
          type="number"
          min={10}
          max={600}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="h-8 w-16 rounded border bg-background px-2 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => start(Math.min(600, Math.max(10, Number(custom) || 60)))}
        >
          စ
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Timer className="h-4 w-4 text-primary" />
          {running || finished ? `${remaining}s` : `${duration}s`}
        </span>
        <Stats wpm={wpm} accuracy={t.accuracy} combo={t.combo} score={t.score} />
      </div>

      {running || finished ? (
        <>
          <TargetText target={target} typed={t.typed} />
          <KeyboardView nextKey={finished ? null : nextKey} />
          <input
            ref={inputRef}
            value={t.typed}
            onChange={(e) => onlyForward(e.target.value, target, t.onType)}
            disabled={finished}
            placeholder="စရိုက်ပါ…"
            className="w-full rounded-lg border bg-background p-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
            <Keyboard className="h-10 w-10" />
            <p className="text-sm">
              အချိန်တစ်ခု ရွေး၍ စိန်ခေါ်မှုကို စတင်ပါ။ အမြင့်ဆုံး WPM: {initialBestWpm}
            </p>
          </CardContent>
        </Card>
      )}

      {finished ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
            <Trophy className="h-8 w-8 text-amber-500" />
            <p className="font-semibold">
              🏁 {duration}s — WPM {wpm} · တိကျမှု {t.accuracy}% · Combo ×{t.maxCombo} ·
              ရမှတ် {t.score}
            </p>
            <Button size="sm" onClick={() => start(duration)}>
              <RotateCcw className="mr-1 h-4 w-4" /> ထပ်ကစား
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
