"use client";

import * as React from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Ear,
  Keyboard,
  Mic,
  Volume2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MY_UI, type LangUiStrings, type Phrase } from "@/lib/learn/languages";
import {
  getRecognitionCtor,
  isRecognitionSupported,
  isTtsSupported,
  similarity,
  speak,
  type SpeechRecognitionLike,
} from "@/lib/learn/speech";

type Mode = "listen" | "speak" | "type";

/** A label shown in both the target language and Burmese, e.g. "Listen · နားထောင်". */
function bilingual(target: string, my: string): string {
  return `${target} · ${my}`;
}

/**
 * Interactive practice for a language unit. Three modes, all client-side:
 *  • Listen — flashcards with text-to-speech (photo, target, pronunciation).
 *  • Speak — the browser listens and scores pronunciation accuracy.
 *  • Type  — a typing tutor with per-character highlighting (+ an on-screen
 *    keyboard hint for Latin scripts).
 *
 * Every control is labelled in both the language being studied and Burmese.
 */
export function LanguageTrainer({
  items,
  lang,
  ui,
}: {
  items: Phrase[];
  lang: string;
  ui: LangUiStrings;
}) {
  const [mode, setMode] = React.useState<Mode>("listen");

  const modes: { key: Mode; icon: typeof Ear; label: string }[] = [
    { key: "listen", icon: Ear, label: bilingual(ui.listen, MY_UI.listen) },
    { key: "speak", icon: Mic, label: bilingual(ui.speak, MY_UI.speak) },
    { key: "type", icon: Keyboard, label: bilingual(ui.type, MY_UI.type) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-medium leading-tight transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4" /> {m.label}
            </button>
          );
        })}
      </div>

      {mode === "listen" ? (
        <ListenMode items={items} lang={lang} />
      ) : mode === "speak" ? (
        <SpeakMode items={items} lang={lang} ui={ui} />
      ) : (
        <TypeMode items={items} lang={lang} ui={ui} />
      )}
    </div>
  );
}

/** Small round "speak this aloud" button. */
function SpeakButton({
  text,
  lang,
  large,
}: {
  text: string;
  lang: string;
  large?: boolean;
}) {
  const t = useTranslations("lang");
  // Detect support only after mount. On the server (and the first client
  // render) window is undefined, so we optimistically assume support and keep
  // the button enabled; this avoids a hydration mismatch that could otherwise
  // leave the button stuck disabled. If the browser truly lacks TTS, the effect
  // disables it right after mount.
  const [supported, setSupported] = React.useState(true);
  React.useEffect(() => setSupported(isTtsSupported()), []);
  return (
    <button
      type="button"
      disabled={!supported}
      title={supported ? t("playAudio") : t("ttsUnsupported")}
      onClick={() => speak(text, lang)}
      className={`flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40 ${
        large ? "h-14 w-14" : "h-10 w-10"
      }`}
    >
      <Volume2 className={large ? "h-6 w-6" : "h-5 w-5"} />
    </button>
  );
}

// --- Listen ----------------------------------------------------------------
function ListenMode({ items, lang }: { items: Phrase[]; lang: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="text-3xl" aria-hidden>
              {item.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold" lang={lang}>
                {item.target}
              </p>
              <p className="text-xs text-muted-foreground">{item.roman}</p>
              <p className="text-sm">{item.my}</p>
            </div>
            <SpeakButton text={item.target} lang={lang} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Shared card-stepper header: which card of how many, prev/next. */
function Stepper({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={index === 0}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground">
        {index + 1} / {total}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onNext}
        disabled={index === total - 1}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// --- Speak (pronunciation check) -------------------------------------------
function SpeakMode({
  items,
  lang,
  ui,
}: {
  items: Phrase[];
  lang: string;
  ui: LangUiStrings;
}) {
  const t = useTranslations("lang");
  const [index, setIndex] = React.useState(0);
  const [listening, setListening] = React.useState(false);
  const [heard, setHeard] = React.useState<string | null>(null);
  const [score, setScore] = React.useState<number | null>(null);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);
  // Detect support after mount to avoid an SSR hydration mismatch (window is
  // undefined on the server). Assume supported until proven otherwise so the
  // full practice UI hydrates cleanly, then swap to the fallback if needed.
  const [supported, setSupported] = React.useState(true);
  React.useEffect(() => setSupported(isRecognitionSupported()), []);
  const item = items[index] ?? items[0]!;

  const reset = React.useCallback(() => {
    setHeard(null);
    setScore(null);
    setListening(false);
  }, []);

  const go = (next: number) => {
    recRef.current?.stop();
    reset();
    setIndex(next);
  };

  React.useEffect(() => () => recRef.current?.stop(), []);

  function listen() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    reset();
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setHeard(transcript);
      setScore(similarity(transcript, item.target));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  if (!supported) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6 text-center">
          <Mic className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t("recUnsupportedTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("recUnsupportedHint")}</p>
        </CardContent>
      </Card>
    );
  }

  const passed = score !== null && score >= 70;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <Stepper
          index={index}
          total={items.length}
          onPrev={() => go(Math.max(0, index - 1))}
          onNext={() => go(Math.min(items.length - 1, index + 1))}
        />

        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span className="text-4xl" aria-hidden>
            {item.emoji}
          </span>
          <p className="text-2xl font-bold" lang={lang}>
            {item.target}
          </p>
          <p className="text-xs text-muted-foreground">{item.roman}</p>
          <p className="text-sm text-muted-foreground">{item.my}</p>
          <div className="mt-1">
            <SpeakButton text={item.target} lang={lang} />
          </div>
        </div>

        <Button
          className="w-full"
          variant={listening ? "destructive" : "default"}
          onClick={listening ? () => recRef.current?.stop() : listen}
        >
          <Mic className="mr-1.5 h-4 w-4" />
          {listening ? t("listening") : bilingual(ui.tapToSpeak, MY_UI.tapToSpeak)}
        </Button>

        {score !== null ? (
          <div
            className={`rounded-lg border p-3 text-center ${
              passed
                ? "border-primary/40 bg-primary/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              {passed ? (
                <Check className="h-5 w-5 text-primary" />
              ) : (
                <X className="h-5 w-5 text-destructive" />
              )}
              <span className="text-lg font-bold">{score}%</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("youSaid")}: <span className="font-medium">{heard || "—"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {passed ? t("greatJob") : t("tryAgain")}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Type (typing tutor) ---------------------------------------------------
function TypeMode({
  items,
  lang,
  ui,
}: {
  items: Phrase[];
  lang: string;
  ui: LangUiStrings;
}) {
  const t = useTranslations("lang");
  const [index, setIndex] = React.useState(0);
  const [value, setValue] = React.useState("");
  const item = items[index] ?? items[0]!;

  const go = (next: number) => {
    setValue("");
    setIndex(next);
  };

  const target = item.target;
  const score = value ? similarity(value, target) : null;
  const correct = value.length > 0 && value === target;
  // The next character the learner should type (for the keyboard hint).
  const nextChar =
    value.length < target.length ? (target[value.length] ?? null) : null;
  // The on-screen keyboard hint only makes sense for Latin-script targets.
  const showKeyboard = lang.startsWith("en");

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <Stepper
          index={index}
          total={items.length}
          onPrev={() => go(Math.max(0, index - 1))}
          onNext={() => go(Math.min(items.length - 1, index + 1))}
        />

        <div className="flex flex-col items-center gap-1 py-1 text-center">
          <span className="text-3xl" aria-hidden>
            {item.emoji}
          </span>
          <p className="text-sm text-muted-foreground">{item.my}</p>
          <p className="text-xs text-muted-foreground">{item.roman}</p>
          <div className="mt-1 flex items-center gap-2">
            <SpeakButton text={target} lang={lang} />
            <span className="text-xs text-muted-foreground">
              {bilingual(ui.typeHint, MY_UI.typeHint)}
            </span>
          </div>
        </div>

        {/* Per-character target with live correctness highlighting. */}
        <div
          className="flex flex-wrap justify-center gap-0.5 rounded-lg border bg-muted/30 p-3 text-xl"
          lang={lang}
          aria-hidden
        >
          {Array.from(target).map((ch, i) => {
            const typed = i < value.length;
            const ok = typed && value[i] === ch;
            const wrong = typed && value[i] !== ch;
            const isNext = i === value.length;
            return (
              <span
                key={i}
                className={`min-w-[0.6em] rounded px-0.5 font-mono transition-colors ${
                  ok
                    ? "bg-primary/15 text-primary"
                    : wrong
                      ? "bg-destructive/15 text-destructive line-through"
                      : isNext
                        ? "bg-primary/10 text-foreground underline"
                        : "text-muted-foreground"
                }`}
              >
                {ch === " " ? " " : ch}
              </span>
            );
          })}
        </div>

        <input
          autoFocus
          value={value}
          lang={lang}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("typePlaceholder")}
          className="w-full rounded-lg border bg-background px-3 py-2 text-center text-lg"
        />

        {showKeyboard ? <KeyboardHint nextChar={nextChar} /> : null}

        {score !== null ? (
          <div
            className={`rounded-lg border p-3 text-center ${
              correct
                ? "border-primary/40 bg-primary/5"
                : "border-muted bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              {correct ? <Check className="h-5 w-5 text-primary" /> : null}
              <span className="text-lg font-bold">{score}%</span>
            </div>
            {correct ? (
              <p className="mt-1 text-xs text-primary">{t("correct")}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("target")}:{" "}
                <span className="font-medium" lang={lang}>
                  {target}
                </span>
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// A simple on-screen QWERTY keyboard that highlights the next key to press.
// Latin scripts only — it's a touch-typing aid for the English course.
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;

function KeyboardHint({ nextChar }: { nextChar: string | null }) {
  const next = nextChar ? nextChar.toLowerCase() : null;
  const isSpace = next === " ";
  return (
    <div className="select-none space-y-1 rounded-lg border bg-muted/20 p-2">
      {KEY_ROWS.map((row) => (
        <div key={row} className="flex justify-center gap-1">
          {Array.from(row).map((k) => {
            const active = k === next;
            return (
              <span
                key={k}
                className={`flex h-7 w-6 items-center justify-center rounded text-xs font-medium uppercase transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground ring-2 ring-primary"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {k}
              </span>
            );
          })}
        </div>
      ))}
      <div className="flex justify-center pt-0.5">
        <span
          className={`flex h-6 w-40 items-center justify-center rounded text-[10px] transition-colors ${
            isSpace
              ? "bg-primary text-primary-foreground ring-2 ring-primary"
              : "bg-background text-muted-foreground"
          }`}
        >
          space
        </span>
      </div>
    </div>
  );
}
