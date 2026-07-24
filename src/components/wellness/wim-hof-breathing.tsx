"use client";

import * as React from "react";
import {
  ChevronDown,
  History,
  Info,
  Play,
  RotateCcw,
  ShieldAlert,
  Square,
  Video,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A full guided Wim Hof–style breathing trainer, built from browser primitives
 * so it ships with the app (CSP-safe): the visual guidance is an animated orb +
 * an SVG cycle infographic, the breath cues are **real breathing sounds**
 * synthesised from filtered Web Audio noise, and the spoken coaching uses the
 * browser's SpeechSynthesis. Every string is localised (follows the app's
 * language toggle), and it ships with a guided video, a step-by-step guide, a
 * history & science section, a safety notice and a help/FAQ.
 *
 * Not medical advice. Never practise in or near water, while driving, or
 * standing up. See the safety panel below.
 */

type Phase = "idle" | "breathing" | "holdEmpty" | "holdFull" | "finished";
type Pace = "slow" | "medium" | "fast";

const PACE_MS: Record<Pace, { in: number; out: number }> = {
  slow: { in: 2200, out: 2200 },
  medium: { in: 1700, out: 1700 },
  fast: { in: 1300, out: 1300 },
};

const RECOVERY_SECONDS = 15;
const RETENTION_CAP_SECONDS = 180;
// Official guided Wim Hof breathing session (embedded via the CSP-allowed
// youtube-nocookie domain). If it ever changes, the "open on YouTube" link and
// the rest of the trainer still work.
const VIDEO_ID = "tybOi4hjZFQ";

function mmss(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function WimHofBreathing() {
  const t = useTranslations("wellnessBreath");
  const locale = useLocale();

  // ---- Settings -------------------------------------------------------------
  const [rounds, setRounds] = React.useState(3);
  const [breaths, setBreaths] = React.useState(30);
  const [pace, setPace] = React.useState<Pace>("medium");
  const [sound, setSound] = React.useState(true);
  const [voice, setVoice] = React.useState(true);

  // ---- Live session state ---------------------------------------------------
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [round, setRound] = React.useState(1);
  const [breathNo, setBreathNo] = React.useState(0);
  const [orbScale, setOrbScale] = React.useState(0.45);
  const [orbMs, setOrbMs] = React.useState(1200);
  const [orbLabel, setOrbLabel] = React.useState(t("ready"));
  const [holdSecs, setHoldSecs] = React.useState(0);
  const [retentions, setRetentions] = React.useState<number[]>([]);

  const cfg = React.useRef({ rounds, breaths, pace, sound, voice });
  React.useEffect(() => {
    cfg.current = { rounds, breaths, pace, sound, voice };
  }, [rounds, breaths, pace, sound, voice]);

  // The idle orb label should follow a language change.
  React.useEffect(() => {
    if (phase === "idle") setOrbLabel(t("ready"));
  }, [t, phase]);

  // ---- Scheduling / lifecycle guards ---------------------------------------
  const runId = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = React.useRef<AudioContext | null>(null);
  const wakeLock = React.useRef<WakeLockSentinel | null>(null);

  const clearTimers = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (ticker.current) clearInterval(ticker.current);
    timer.current = null;
    ticker.current = null;
  }, []);

  // ---- Audio ----------------------------------------------------------------
  const ensureAudio = React.useCallback((): AudioContext | null => {
    if (!cfg.current.sound) return null;
    try {
      if (!audio.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audio.current = new Ctor();
      }
      if (audio.current.state === "suspended") void audio.current.resume();
      return audio.current;
    } catch {
      return null;
    }
  }, []);

  /**
   * A realistic breath sound: band-pass-filtered white noise whose amplitude
   * and brightness swell on the inhale and fade on the exhale — it sounds like
   * actual breathing rather than a beep.
   */
  const breathSound = React.useCallback(
    (kind: "in" | "out", ms: number) => {
      const ctx = ensureAudio();
      if (!ctx) return;
      try {
        const dur = ms / 1000;
        const frames = Math.max(1, Math.ceil(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = "bandpass";
        filt.Q.value = 0.8;
        const gain = ctx.createGain();
        const t0 = ctx.currentTime;
        if (kind === "in") {
          filt.frequency.setValueAtTime(320, t0);
          filt.frequency.linearRampToValueAtTime(950, t0 + dur);
          gain.gain.setValueAtTime(0.0008, t0);
          gain.gain.exponentialRampToValueAtTime(0.32, t0 + dur * 0.7);
          gain.gain.exponentialRampToValueAtTime(0.02, t0 + dur);
        } else {
          filt.frequency.setValueAtTime(760, t0);
          filt.frequency.linearRampToValueAtTime(240, t0 + dur);
          gain.gain.setValueAtTime(0.3, t0);
          gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
        }
        src.connect(filt);
        filt.connect(gain);
        gain.connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + dur + 0.05);
      } catch {
        /* audio unavailable — visuals still guide the breath */
      }
    },
    [ensureAudio],
  );

  const gong = React.useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 396;
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 2.5);
    } catch {
      /* ignore */
    }
  }, [ensureAudio]);

  const speak = React.useCallback(
    (text: string) => {
      if (!cfg.current.voice) return;
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = locale === "my" ? "my-MM" : "en-US";
        u.rate = 0.92;
        synth.speak(u);
      } catch {
        /* speech unavailable */
      }
    },
    [locale],
  );

  // ---- Wake lock ------------------------------------------------------------
  const requestWakeLock = React.useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> };
      };
      if (nav.wakeLock) wakeLock.current = await nav.wakeLock.request("screen");
    } catch {
      /* not supported / denied */
    }
  }, []);

  const releaseWakeLock = React.useCallback(() => {
    try {
      void wakeLock.current?.release();
    } catch {
      /* ignore */
    }
    wakeLock.current = null;
  }, []);

  // ---- State machine (stable callbacks; live values via refs) --------------
  const roundRef = React.useRef(1);
  const holdSecsRef = React.useRef(0);
  React.useEffect(() => {
    holdSecsRef.current = holdSecs;
  }, [holdSecs]);
  // Latest translator/label helpers for the timed callbacks.
  const tRef = React.useRef(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);

  const startRecovery = React.useCallback(
    (myRun: number, nextRound: number) => {
      if (runId.current !== myRun) return;
      setPhase("holdFull");
      setOrbLabel(tRef.current("holdFullLabel"));
      setOrbMs(2500);
      setOrbScale(1.1);
      gong();
      speak(tRef.current("voiceRecovery"));
      let left = RECOVERY_SECONDS;
      setHoldSecs(left);
      ticker.current = setInterval(() => {
        if (runId.current !== myRun) return;
        left -= 1;
        setHoldSecs(left);
        if (left <= 0) {
          if (ticker.current) clearInterval(ticker.current);
          ticker.current = null;
          startBreathing(myRun, nextRound);
        }
      }, 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gong, speak],
  );

  const startRecoveryThenFinish = React.useCallback(
    (myRun: number) => {
      if (runId.current !== myRun) return;
      setPhase("holdFull");
      setOrbLabel(tRef.current("holdFullLabel"));
      setOrbMs(2500);
      setOrbScale(1.1);
      gong();
      speak(tRef.current("voiceFinalRecovery"));
      let left = RECOVERY_SECONDS;
      setHoldSecs(left);
      ticker.current = setInterval(() => {
        if (runId.current !== myRun) return;
        left -= 1;
        setHoldSecs(left);
        if (left <= 0) {
          if (ticker.current) clearInterval(ticker.current);
          ticker.current = null;
          finish(myRun);
        }
      }, 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gong, speak],
  );

  const endRetention = React.useCallback(() => {
    const myRun = runId.current;
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setRetentions((prev) => [...prev, holdSecsRef.current]);
    const nextRound = roundRef.current + 1;
    if (nextRound > cfg.current.rounds) startRecoveryThenFinish(myRun);
    else startRecovery(myRun, nextRound);
  }, [startRecovery, startRecoveryThenFinish]);

  const startRetention = React.useCallback(
    (myRun: number, thisRound: number) => {
      if (runId.current !== myRun) return;
      setPhase("holdEmpty");
      setOrbLabel(tRef.current("holdEmptyLabel"));
      setOrbMs(3000);
      setOrbScale(0.4);
      gong();
      speak(tRef.current("voiceHold", { round: thisRound }));
      let secs = 0;
      setHoldSecs(0);
      ticker.current = setInterval(() => {
        if (runId.current !== myRun) return;
        secs += 1;
        setHoldSecs(secs);
        if (secs >= RETENTION_CAP_SECONDS) endRetention();
      }, 1000);
    },
    [gong, speak, endRetention],
  );

  const startBreathing = React.useCallback(
    (myRun: number, thisRound: number) => {
      if (runId.current !== myRun) return;
      roundRef.current = thisRound;
      setPhase("breathing");
      setRound(thisRound);
      setBreathNo(0);
      speak(tRef.current("voiceBegin", { round: thisRound }));
      const p = PACE_MS[cfg.current.pace];
      const target = cfg.current.breaths;

      const inhale = (n: number) => {
        if (runId.current !== myRun) return;
        if (n > target) {
          startRetention(myRun, thisRound);
          return;
        }
        setBreathNo(n);
        setOrbLabel(tRef.current("breatheIn"));
        setOrbMs(p.in);
        setOrbScale(1.08);
        breathSound("in", p.in);
        timer.current = setTimeout(() => {
          if (runId.current !== myRun) return;
          setOrbLabel(tRef.current("letGo"));
          setOrbMs(p.out);
          setOrbScale(0.45);
          breathSound("out", p.out);
          timer.current = setTimeout(() => inhale(n + 1), p.out);
        }, p.in);
      };
      inhale(1);
    },
    [speak, breathSound, startRetention],
  );

  const finish = React.useCallback(
    (myRun: number) => {
      if (runId.current !== myRun) return;
      clearTimers();
      setPhase("finished");
      setOrbLabel(tRef.current("complete"));
      setOrbScale(0.7);
      gong();
      speak(tRef.current("voiceDone"));
      releaseWakeLock();
    },
    [clearTimers, gong, speak, releaseWakeLock],
  );

  const start = React.useCallback(() => {
    runId.current += 1;
    const myRun = runId.current;
    clearTimers();
    setRetentions([]);
    void requestWakeLock();
    ensureAudio();
    startBreathing(myRun, 1);
  }, [clearTimers, requestWakeLock, ensureAudio, startBreathing]);

  const stop = React.useCallback(() => {
    runId.current += 1;
    clearTimers();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    releaseWakeLock();
    roundRef.current = 1;
    setPhase("idle");
    setOrbLabel(tRef.current("ready"));
    setOrbScale(0.45);
    setBreathNo(0);
    setHoldSecs(0);
    setRound(1);
  }, [clearTimers, releaseWakeLock]);

  React.useEffect(() => {
    return () => {
      runId.current += 1;
      clearTimers();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      releaseWakeLock();
    };
  }, [clearTimers, releaseWakeLock]);

  const active = phase !== "idle" && phase !== "finished";
  const p = PACE_MS[pace];
  const paceWord =
    pace === "slow" ? t("paceSlow") : pace === "fast" ? t("paceFast") : t("paceMedium");

  // ---- Render ---------------------------------------------------------------
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Wind className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">{t("title")}</p>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>

        {/* Safety notice */}
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">{t("safetyTitle")}</span>{" "}
            {t("safetyBody")}
          </p>
        </div>

        {/* Breathing stage */}
        <div className="flex flex-col items-center gap-4 py-2">
          <BreathOrb
            scale={orbScale}
            ms={orbMs}
            label={orbLabel}
            phase={phase}
            holdSecs={holdSecs}
          />

          {/* Breath progress dots */}
          {phase === "breathing" && (
            <BreathDots total={breaths} current={breathNo} />
          )}

          {/* Round pips */}
          {(active || phase === "finished") && rounds > 1 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: rounds }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i < round - 1 || phase === "finished"
                      ? "bg-primary"
                      : i === round - 1
                        ? "bg-primary/60 ring-2 ring-primary/30"
                        : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Status line */}
          <div className="min-h-[1.25rem] text-center text-sm text-muted-foreground">
            {phase === "breathing" &&
              t("roundBreath", {
                round,
                total: rounds,
                n: breathNo,
                breaths,
              })}
            {phase === "holdEmpty" &&
              t("roundHoldEmpty", { round, total: rounds })}
            {phase === "holdFull" && t("recoveryHold", { secs: holdSecs })}
            {(phase === "idle" || phase === "finished") &&
              t("config", { rounds, breaths, pace: paceWord })}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {phase === "idle" && (
              <Button onClick={start} size="lg">
                <Play className="mr-1 h-4 w-4" /> {t("startSession")}
              </Button>
            )}
            {phase === "holdEmpty" && (
              <Button onClick={endRetention} size="lg">
                <Waves className="mr-1 h-4 w-4" /> {t("breatheInCta")}
              </Button>
            )}
            {phase === "finished" && (
              <Button onClick={start} size="lg">
                <RotateCcw className="mr-1 h-4 w-4" /> {t("goAgain")}
              </Button>
            )}
            {active && (
              <Button onClick={stop} variant="outline">
                <Square className="mr-1 h-4 w-4" /> {t("stop")}
              </Button>
            )}
            {(phase === "idle" || phase === "finished") && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-pressed={sound}
                  aria-label={sound ? t("soundOn") : t("soundOff")}
                  onClick={() => setSound((s) => !s)}
                >
                  {sound ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={voice}
                  onClick={() => setVoice((v) => !v)}
                >
                  {voice ? t("voiceOn") : t("voiceOff")}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Settings */}
        {(phase === "idle" || phase === "finished") && (
          <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-3">
            <Stepper
              label={t("rounds")}
              value={rounds}
              min={1}
              max={6}
              onChange={setRounds}
            />
            <Stepper
              label={t("breathsPerRound")}
              value={breaths}
              min={20}
              max={50}
              step={5}
              onChange={setBreaths}
            />
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {t("pace")}
              </p>
              <div className="flex gap-1">
                {(["slow", "medium", "fast"] as Pace[]).map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setPace(x)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      pace === x
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {x === "slow"
                      ? t("paceSlow")
                      : x === "fast"
                        ? t("paceFast")
                        : t("paceMedium")}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("perBreath", { s: ((p.in + p.out) / 1000).toFixed(1) })}
              </p>
            </div>
          </div>
        )}

        {/* Session summary */}
        {phase === "finished" && retentions.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 text-sm font-semibold">{t("retentionTimes")}</p>
            <div className="flex flex-wrap gap-2">
              {retentions.map((r, i) => (
                <span
                  key={i}
                  className="rounded-full bg-background px-3 py-1 text-sm tabular-nums shadow-sm"
                >
                  R{i + 1}: {mmss(r)}
                </span>
              ))}
              <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary tabular-nums">
                {t("best", { time: mmss(Math.max(...retentions)) })}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("retentionNote")}
            </p>
          </div>
        )}

        {/* Infographic — the 4-phase cycle */}
        <CycleInfographic />

        {/* Guide + video + history + help */}
        <div className="space-y-2">
          <Foldout
            icon={<Info className="h-4 w-4 text-primary" />}
            title={t("guideTitle")}
            defaultOpen={phase === "idle"}
          >
            <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">{t("step1t")}</span>{" "}
                {t("step1b")}
              </li>
              <li>
                <span className="font-medium text-foreground">
                  {t("step2t", { breaths })}
                </span>{" "}
                {t("step2b")}
              </li>
              <li>
                <span className="font-medium text-foreground">{t("step3t")}</span>{" "}
                {t("step3b")}
              </li>
              <li>
                <span className="font-medium text-foreground">
                  {t("step4t", { secs: RECOVERY_SECONDS })}
                </span>{" "}
                {t("step4b", { secs: RECOVERY_SECONDS })}
              </li>
              <li>
                <span className="font-medium text-foreground">{t("step5t")}</span>{" "}
                {t("step5b", { rounds })}
              </li>
            </ol>
          </Foldout>

          <Foldout
            icon={<Video className="h-4 w-4 text-primary" />}
            title={t("videoTitle")}
          >
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("videoNote")}</p>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`}
                  title={t("videoTitle")}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${VIDEO_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-medium text-primary hover:underline"
              >
                {t("videoOpen")}
              </a>
            </div>
          </Foldout>

          <Foldout
            icon={<History className="h-4 w-4 text-primary" />}
            title={t("historyTitle")}
          >
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("historyOrigins")}</p>
              <p>{t("historyIceman")}</p>
              <p>{t("historyScience")}</p>
            </div>
          </Foldout>

          <Foldout
            icon={<Waves className="h-4 w-4 text-primary" />}
            title={t("faqTitle")}
          >
            <div className="space-y-3 text-sm text-muted-foreground">
              <FaqRow q={t("faqQ1")}>{t("faqA1")}</FaqRow>
              <FaqRow q={t("faqQ2")}>
                {t("faqA2", { cap: RETENTION_CAP_SECONDS / 60 })}
              </FaqRow>
              <FaqRow q={t("faqQ3")}>{t("faqA3")}</FaqRow>
              <FaqRow q={t("faqQ4")}>{t("faqA4")}</FaqRow>
              <FaqRow q={t("faqQ5")}>{t("faqA5")}</FaqRow>
            </div>
          </Foldout>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Animated breathing orb                                                     */
/* -------------------------------------------------------------------------- */

function BreathOrb({
  scale,
  ms,
  label,
  phase,
  holdSecs,
}: {
  scale: number;
  ms: number;
  label: string;
  phase: Phase;
  holdSecs: number;
}) {
  const holding = phase === "holdEmpty" || phase === "holdFull";
  return (
    <div className="relative flex h-56 w-56 items-center justify-center">
      <div
        className="absolute rounded-full bg-primary/25 blur-2xl"
        style={{
          height: "70%",
          width: "70%",
          transform: `scale(${scale})`,
          transitionProperty: "transform",
          transitionDuration: `${ms}ms`,
          transitionTimingFunction: "ease-in-out",
        }}
        aria-hidden
      />
      <div
        className="absolute rounded-full border border-primary/20"
        style={{ height: "88%", width: "88%" }}
        aria-hidden
      />
      <div
        className={`absolute rounded-full bg-gradient-to-br from-primary/80 to-primary shadow-lg ${
          holding ? "animate-pulse" : ""
        }`}
        style={{
          height: "62%",
          width: "62%",
          transform: `scale(${scale})`,
          transitionProperty: "transform",
          transitionDuration: `${ms}ms`,
          transitionTimingFunction: "ease-in-out",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="px-2 text-sm font-medium text-primary-foreground drop-shadow">
          {label}
        </span>
        {holding && (
          <span className="text-3xl font-bold tabular-nums text-primary-foreground drop-shadow">
            {holdSecs}s
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Breath progress dots                                                       */
/* -------------------------------------------------------------------------- */

function BreathDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex max-w-[16rem] flex-wrap justify-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            i < current ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cycle infographic                                                          */
/* -------------------------------------------------------------------------- */

function CycleInfographic() {
  const t = useTranslations("wellnessBreath");
  const phases = [
    { n: 1, label: t("phasePower"), icon: <Wind className="h-4 w-4" />, tone: "bg-primary/15 text-primary" },
    { n: 2, label: t("phaseHold"), icon: <Square className="h-4 w-4" />, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
    { n: 3, label: t("phaseRecover"), icon: <Waves className="h-4 w-4" />, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { n: 4, label: t("phaseRepeat"), icon: <RotateCcw className="h-4 w-4" />, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  ];
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <p className="mb-3 text-sm font-semibold">{t("infoTitle")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {phases.map((ph) => (
          <div
            key={ph.n}
            className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/40 p-3 text-center"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${ph.tone}`}
            >
              {ph.icon}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {ph.n}
            </span>
            <span className="text-xs font-medium leading-tight">{ph.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("infoNote")}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="h-8 w-8 rounded-md bg-background text-lg leading-none hover:bg-secondary disabled:opacity-40"
          disabled={value <= min}
          aria-label={`− ${label}`}
        >
          −
        </button>
        <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="h-8 w-8 rounded-md bg-background text-lg leading-none hover:bg-secondary disabled:opacity-40"
          disabled={value >= max}
          aria-label={`+ ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Foldout({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-border bg-background/50"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold">
        {icon}
        <span className="flex-1">{title}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}

function FaqRow({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-foreground">{q}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}
