"use client";

import * as React from "react";
import {
  ChevronDown,
  Info,
  Play,
  RotateCcw,
  ShieldAlert,
  Square,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A full guided Wim Hof–style breathing trainer, built entirely from browser
 * primitives so it ships with the app (no audio/video files, no external CDN —
 * CSP-safe): the visual guidance is an animated SVG orb, the breath cues are
 * Web Audio tones, and the spoken coaching uses the browser's SpeechSynthesis.
 * It runs the classic cycle — power breaths → exhale-hold (retention) →
 * inhale-hold (recovery) — for a configurable number of rounds, records each
 * retention time, and ships with an in-page guide, safety notice and help/FAQ.
 *
 * Not medical advice. Never practise in or near water, while driving, or
 * standing up. See the safety panel below.
 */

type Phase = "idle" | "breathing" | "holdEmpty" | "holdFull" | "finished";

type Pace = "slow" | "medium" | "fast";

// Milliseconds per inhale / exhale for each pace preset.
const PACE_MS: Record<Pace, { in: number; out: number }> = {
  slow: { in: 2200, out: 2200 },
  medium: { in: 1700, out: 1700 },
  fast: { in: 1300, out: 1300 },
};

const RECOVERY_SECONDS = 15; // inhale-hold after each retention
const RETENTION_CAP_SECONDS = 180; // safety auto-advance if someone forgets to tap

function mmss(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function WimHofBreathing() {
  // ---- Settings (editable while idle) --------------------------------------
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
  const [orbLabel, setOrbLabel] = React.useState("Ready");
  const [holdSecs, setHoldSecs] = React.useState(0);
  const [retentions, setRetentions] = React.useState<number[]>([]);

  // Mirror settings into refs so the timed driver always reads current values.
  const cfg = React.useRef({ rounds, breaths, pace, sound, voice });
  React.useEffect(() => {
    cfg.current = { rounds, breaths, pace, sound, voice };
  }, [rounds, breaths, pace, sound, voice]);

  // ---- Scheduling / lifecycle guards ---------------------------------------
  const runId = React.useRef(0); // bump to cancel any in-flight schedule
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

  // ---- Audio + voice helpers -----------------------------------------------
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

  /** A soft sine tone that optionally glides from → to over its duration. */
  const tone = React.useCallback(
    (from: number, to: number, ms: number, peak = 0.16) => {
      const ctx = ensureAudio();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const t0 = ctx.currentTime;
        const dur = ms / 1000;
        osc.frequency.setValueAtTime(from, t0);
        osc.frequency.linearRampToValueAtTime(to, t0 + dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      } catch {
        // Audio unavailable — the visuals still guide the breath.
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

  const speak = React.useCallback((text: string) => {
    if (!cfg.current.voice) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 1;
      synth.speak(u);
    } catch {
      /* speech unavailable */
    }
  }, []);

  // ---- Wake lock (keep the screen on during a session) ----------------------
  const requestWakeLock = React.useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> };
      };
      if (nav.wakeLock) wakeLock.current = await nav.wakeLock.request("screen");
    } catch {
      /* not supported / denied — fine */
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

  // ---- Core state machine ---------------------------------------------------
  // Live values the timed transitions read, kept in refs so a single stable
  // set of callbacks always sees the current round / retention without being
  // re-created (which would strand in-flight timers on a stale closure).
  const roundRef = React.useRef(1);
  const holdSecsRef = React.useRef(0);
  React.useEffect(() => {
    holdSecsRef.current = holdSecs;
  }, [holdSecs]);

  const startRecovery = React.useCallback(
    (myRun: number, nextRound: number) => {
      if (runId.current !== myRun) return;
      setPhase("holdFull");
      setOrbLabel("Breathe in — hold");
      setOrbMs(2500);
      setOrbScale(1.1);
      gong();
      speak("Now breathe in deeply, and hold.");
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
    // startBreathing referenced via closure (stable); listing it would form a
    // cycle. All are stable so the single instances always match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gong, speak],
  );

  const startRecoveryThenFinish = React.useCallback(
    (myRun: number) => {
      if (runId.current !== myRun) return;
      setPhase("holdFull");
      setOrbLabel("Breathe in — hold");
      setOrbMs(2500);
      setOrbScale(1.1);
      gong();
      speak("Final recovery breath. Breathe in, and hold.");
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
    if (nextRound > cfg.current.rounds) {
      // Last round still gets a recovery breath, then finish.
      startRecoveryThenFinish(myRun);
    } else {
      startRecovery(myRun, nextRound);
    }
  }, [startRecovery, startRecoveryThenFinish]);

  const startRetention = React.useCallback(
    (myRun: number, thisRound: number) => {
      if (runId.current !== myRun) return;
      setPhase("holdEmpty");
      setOrbLabel("Exhale — hold empty");
      setOrbMs(3000);
      setOrbScale(0.4);
      gong();
      speak(`Round ${thisRound}. Exhale everything, and hold.`);
      let secs = 0;
      setHoldSecs(0);
      ticker.current = setInterval(() => {
        if (runId.current !== myRun) return;
        secs += 1;
        setHoldSecs(secs);
        if (secs >= RETENTION_CAP_SECONDS) {
          endRetention(); // safety cap — end the hold automatically
        }
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
      speak(`Round ${thisRound}. Begin power breathing.`);
      const p = PACE_MS[cfg.current.pace];
      const target = cfg.current.breaths;

      const inhale = (n: number) => {
        if (runId.current !== myRun) return;
        if (n > target) {
          startRetention(myRun, thisRound);
          return;
        }
        setBreathNo(n);
        setOrbLabel("Breathe in");
        setOrbMs(p.in);
        setOrbScale(1.08);
        tone(220, 440, p.in);
        timer.current = setTimeout(() => {
          if (runId.current !== myRun) return;
          setOrbLabel("Let go");
          setOrbMs(p.out);
          setOrbScale(0.45);
          tone(440, 220, p.out);
          timer.current = setTimeout(() => inhale(n + 1), p.out);
        }, p.in);
      };
      inhale(1);
    },
    [speak, tone, startRetention],
  );

  const finish = React.useCallback(
    (myRun: number) => {
      if (runId.current !== myRun) return;
      clearTimers();
      setPhase("finished");
      setOrbLabel("Complete");
      setOrbScale(0.7);
      gong();
      speak("Well done. Rest, and breathe naturally.");
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
    runId.current += 1; // invalidate every pending callback
    clearTimers();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    releaseWakeLock();
    roundRef.current = 1;
    setPhase("idle");
    setOrbLabel("Ready");
    setOrbScale(0.45);
    setBreathNo(0);
    setHoldSecs(0);
    setRound(1);
  }, [clearTimers, releaseWakeLock]);

  // Cleanup on unmount.
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
            <p className="font-semibold">Wim Hof breathing</p>
            <p className="text-sm text-muted-foreground">
              Guided power breaths, breath-hold retention and recovery — with
              a visual pacer, sound cues and voice coaching.
            </p>
          </div>
        </div>

        {/* Safety notice */}
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Safety first.</span> Sit or lie
            down. <span className="font-semibold">Never</span> practise in or
            near water, in a bath, while driving, or standing up — the breath
            holds can make you faint. Tingling or light-headedness is normal;
            stop if it feels too much. Not advised during pregnancy, or with
            epilepsy, high blood pressure or heart conditions without a
            doctor&apos;s clearance.
          </p>
        </div>

        {/* The breathing stage */}
        <div className="flex flex-col items-center gap-4 py-2">
          <BreathOrb
            scale={orbScale}
            ms={orbMs}
            label={orbLabel}
            phase={phase}
            holdSecs={holdSecs}
          />

          {/* Live status line */}
          <div className="text-center">
            {phase === "breathing" && (
              <p className="text-sm text-muted-foreground">
                Round <span className="font-semibold text-foreground">{round}</span> /{" "}
                {rounds} · Breath{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {breathNo}
                </span>{" "}
                / {breaths}
              </p>
            )}
            {phase === "holdEmpty" && (
              <p className="text-sm text-muted-foreground">
                Round {round} / {rounds} · Hold after exhale — tap when you need
                to breathe
              </p>
            )}
            {phase === "holdFull" && (
              <p className="text-sm text-muted-foreground">
                Recovery hold · {holdSecs}s
              </p>
            )}
            {phase === "idle" && (
              <p className="text-sm text-muted-foreground">
                {rounds} rounds · {breaths} breaths · {pace} pace
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {phase === "idle" && (
              <Button onClick={start} size="lg">
                <Play className="mr-1 h-4 w-4" /> Start session
              </Button>
            )}
            {phase === "holdEmpty" && (
              <Button onClick={endRetention} size="lg">
                <Waves className="mr-1 h-4 w-4" /> Breathe in →
              </Button>
            )}
            {phase === "finished" && (
              <Button onClick={start} size="lg">
                <RotateCcw className="mr-1 h-4 w-4" /> Go again
              </Button>
            )}
            {active && (
              <Button onClick={stop} variant="outline">
                <Square className="mr-1 h-4 w-4" /> Stop
              </Button>
            )}
            {(phase === "idle" || phase === "finished") && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-pressed={sound}
                  aria-label={sound ? "Sound on" : "Sound off"}
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
                  Voice {voice ? "on" : "off"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Settings (idle only) */}
        {(phase === "idle" || phase === "finished") && (
          <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-3">
            <Stepper
              label="Rounds"
              value={rounds}
              min={1}
              max={6}
              onChange={setRounds}
            />
            <Stepper
              label="Breaths / round"
              value={breaths}
              min={20}
              max={50}
              step={5}
              onChange={setBreaths}
            />
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Pace
              </p>
              <div className="flex gap-1">
                {(["slow", "medium", "fast"] as Pace[]).map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setPace(x)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs capitalize transition-colors ${
                      pace === x
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                ~{((p.in + p.out) / 1000).toFixed(1)}s / breath
              </p>
            </div>
          </div>
        )}

        {/* Session summary */}
        {phase === "finished" && retentions.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 text-sm font-semibold">Your retention times</p>
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
                Best {mmss(Math.max(...retentions))}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Retention naturally lengthens over rounds and with practice —
              never force it.
            </p>
          </div>
        )}

        {/* Guide + help */}
        <div className="space-y-2">
          <Foldout
            icon={<Info className="h-4 w-4 text-primary" />}
            title="How the method works — step by step"
            defaultOpen={phase === "idle"}
          >
            <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Get settled.</span>{" "}
                Sit or lie somewhere comfortable and safe, on an empty stomach if
                you can. Relax your shoulders.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Power breaths ({breaths}×).
                </span>{" "}
                Breathe in fully through the nose or mouth, then let the exhale
                fall out without forcing. Follow the orb — big = in, small = out.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Retention (hold after exhale).
                </span>{" "}
                After the last breath, exhale and hold with empty lungs. Stay
                relaxed. Tap <em>Breathe in →</em> when you feel the urge to
                breathe.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Recovery ({RECOVERY_SECONDS}s hold).
                </span>{" "}
                Take one deep breath in and hold for {RECOVERY_SECONDS} seconds,
                then release. That completes a round.
              </li>
              <li>
                <span className="font-medium text-foreground">Repeat.</span>{" "}
                Do {rounds} rounds. Afterwards, sit quietly and notice how you
                feel.
              </li>
            </ol>
          </Foldout>

          <Foldout
            icon={<Waves className="h-4 w-4 text-primary" />}
            title="Help & FAQ"
          >
            <div className="space-y-3 text-sm text-muted-foreground">
              <FaqRow q="Why do I feel tingling or light-headed?">
                That&apos;s the normal effect of the deep breathing changing your
                CO₂ levels. It passes. If it&apos;s uncomfortable, slow down or
                stop.
              </FaqRow>
              <FaqRow q="How long should I hold my breath?">
                As long as feels calm and comfortable — never strain. It&apos;s
                common to go longer each round. The app auto-ends a hold at{" "}
                {RETENTION_CAP_SECONDS / 60} minutes for safety.
              </FaqRow>
              <FaqRow q="How often can I practise?">
                Once a day is a great start, ideally in the morning before
                eating. Consistency matters more than length.
              </FaqRow>
              <FaqRow q="The voice or sound isn't playing?">
                Some phones block audio until you tap the screen — press{" "}
                <em>Start session</em> and it will begin. You can also toggle
                sound and voice with the buttons above.
              </FaqRow>
              <FaqRow q="When should I NOT do this?">
                Skip it if you&apos;re pregnant, or have epilepsy, high blood
                pressure, cardiovascular disease, or a history of fainting —
                unless your doctor approves. Never do it in water or while
                moving.
              </FaqRow>
            </div>
          </Foldout>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          For general wellbeing only — not medical advice, diagnosis or
          treatment. The Wim Hof Method® is credited to Wim Hof; this is an
          independent practice aid. Stop and seek help if you feel unwell.
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
      {/* Soft outer glow */}
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
      {/* Faint fixed guide ring */}
      <div
        className="absolute rounded-full border border-primary/20"
        style={{ height: "88%", width: "88%" }}
        aria-hidden
      />
      {/* The living orb */}
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
      {/* Centre readout */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="text-sm font-medium text-primary-foreground drop-shadow">
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
          aria-label={`Decrease ${label}`}
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
          aria-label={`Increase ${label}`}
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
