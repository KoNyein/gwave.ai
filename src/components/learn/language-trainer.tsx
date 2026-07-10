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
import type { Phrase } from "@/lib/learn/languages";
import {
  getRecognitionCtor,
  isRecognitionSupported,
  isTtsSupported,
  similarity,
  speak,
  type SpeechRecognitionLike,
} from "@/lib/learn/speech";

type Mode = "listen" | "speak" | "type";

/**
 * Interactive practice for a language unit. Three modes, all client-side:
 *  • Listen — flashcards with text-to-speech (photo, target, pronunciation).
 *  • Speak — the browser listens and scores pronunciation accuracy.
 *  • Type  — type the phrase; live character-accuracy feedback.
 */
export function LanguageTrainer({
  items,
  lang,
}: {
  items: Phrase[];
  lang: string;
}) {
  const t = useTranslations("lang");
  const [mode, setMode] = React.useState<Mode>("listen");

  const modes: { key: Mode; icon: typeof Ear; label: string }[] = [
    { key: "listen", icon: Ear, label: t("modeListen") },
    { key: "speak", icon: Mic, label: t("modeSpeak") },
    { key: "type", icon: Keyboard, label: t("modeType") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
        <SpeakMode items={items} lang={lang} />
      ) : (
        <TypeMode items={items} lang={lang} />
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
function SpeakMode({ items, lang }: { items: Phrase[]; lang: string }) {
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
          {listening ? t("listening") : t("tapToSpeak")}
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

// --- Type ------------------------------------------------------------------
function TypeMode({ items, lang }: { items: Phrase[]; lang: string }) {
  const t = useTranslations("lang");
  const [index, setIndex] = React.useState(0);
  const [value, setValue] = React.useState("");
  const item = items[index] ?? items[0]!;

  const go = (next: number) => {
    setValue("");
    setIndex(next);
  };

  const score = value ? similarity(value, item.target) : null;
  const correct = score !== null && score >= 90;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <Stepper
          index={index}
          total={items.length}
          onPrev={() => go(Math.max(0, index - 1))}
          onNext={() => go(Math.min(items.length - 1, index + 1))}
        />

        <div className="flex flex-col items-center gap-1 py-2 text-center">
          <span className="text-4xl" aria-hidden>
            {item.emoji}
          </span>
          <p className="text-sm text-muted-foreground">{item.my}</p>
          <p className="text-xs text-muted-foreground">{item.roman}</p>
          <div className="mt-1 flex items-center gap-2">
            <SpeakButton text={item.target} lang={lang} />
            <span className="text-xs text-muted-foreground">{t("typeHint")}</span>
          </div>
        </div>

        <input
          autoFocus
          value={value}
          lang={lang}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("typePlaceholder")}
          className="w-full rounded-lg border bg-background px-3 py-2 text-center text-lg"
        />

        {score !== null ? (
          <div
            className={`rounded-lg border p-3 text-center ${
              correct
                ? "border-primary/40 bg-primary/5"
                : "border-muted bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              {correct ? (
                <Check className="h-5 w-5 text-primary" />
              ) : null}
              <span className="text-lg font-bold">{score}%</span>
            </div>
            {correct ? (
              <p className="mt-1 text-xs text-primary">{t("correct")}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("target")}:{" "}
                <span className="font-medium" lang={lang}>
                  {item.target}
                </span>
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
