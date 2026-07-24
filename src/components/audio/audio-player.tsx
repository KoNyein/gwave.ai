"use client";

import * as React from "react";
import {
  ListMusic,
  Lock,
  Moon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { AudioChapter } from "@/lib/db/audio";

const SPEEDS = [1, 1.2, 1.5, 2];
const SLEEP_OPTIONS = [15, 30, 45]; // minutes

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h > 0 ? m.toString().padStart(2, "0") : m.toString();
  return `${h > 0 ? h + ":" : ""}${mm}:${sec.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  trackId,
  audioUrl,
  durationS,
  chapters,
  entitled,
  resumePosition,
  resumeSpeed,
}: {
  trackId: string;
  audioUrl: string | null;
  durationS: number | null;
  chapters: AudioChapter[];
  entitled: boolean;
  resumePosition: number;
  resumeSpeed: number;
}) {
  const t = useTranslations("audio");
  const ref = React.useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = React.useState(false);
  const [cur, setCur] = React.useState(resumePosition);
  const [dur, setDur] = React.useState(durationS ?? 0);
  const [speed, setSpeed] = React.useState(resumeSpeed || 1);
  const [showChapters, setShowChapters] = React.useState(false);
  const [sleepMin, setSleepMin] = React.useState<number | "chapter" | null>(null);
  const [showSleep, setShowSleep] = React.useState(false);

  const lastSaved = React.useRef(0);
  const sleepDeadline = React.useRef<number | null>(null);
  const seededResume = React.useRef(false);

  const save = React.useCallback(
    (completed = false) => {
      const el = ref.current;
      if (!el) return;
      const payload = {
        position_s: Math.round(el.currentTime),
        duration_s: Math.round(el.duration || dur || 0),
        speed,
        completed,
        device: "web",
      };
      // keepalive so a save still lands during page unload.
      void fetch(`/api/audio/${trackId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    },
    [trackId, dur, speed],
  );

  // Apply chosen speed to the media element.
  React.useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed]);

  // Sleep-timer tick.
  React.useEffect(() => {
    if (sleepMin == null) {
      sleepDeadline.current = null;
      return;
    }
    if (sleepMin !== "chapter") {
      sleepDeadline.current = Date.now() + sleepMin * 60_000;
    }
    const id = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      if (sleepMin === "chapter") {
        const next = chapters.find((c) => c.start_s > el.currentTime);
        if (chapters.length > 0 && !next) {
          el.pause();
          setSleepMin(null);
        }
      } else if (sleepDeadline.current && Date.now() >= sleepDeadline.current) {
        el.pause();
        setSleepMin(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepMin, chapters]);

  // Save on unmount.
  React.useEffect(() => {
    return () => save();
  }, [save]);

  const onLoaded = () => {
    const el = ref.current;
    if (!el) return;
    setDur(el.duration || durationS || 0);
    if (!seededResume.current && resumePosition > 0 && resumePosition < (el.duration || Infinity) - 3) {
      el.currentTime = Math.max(0, resumePosition - 3); // small re-entry rewind
      seededResume.current = true;
    }
    el.playbackRate = speed;
  };

  const onTime = () => {
    const el = ref.current;
    if (!el) return;
    setCur(el.currentTime);
    if (el.currentTime - lastSaved.current >= 10) {
      lastSaved.current = el.currentTime;
      save();
    }
  };

  const toggle = async () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        /* autoplay blocked until gesture — this IS a gesture, so rare */
      }
    } else {
      el.pause();
      save();
    }
  };

  const seek = (to: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(to, el.duration || to));
    setCur(el.currentTime);
    save();
  };

  const nudge = (delta: number) => seek((ref.current?.currentTime ?? 0) + delta);

  const curChapterIdx = chapters.reduce(
    (acc, c, i) => (cur >= c.start_s ? i : acc),
    -1,
  );
  const jumpChapter = (dir: 1 | -1) => {
    if (chapters.length === 0) return;
    const target = Math.max(0, Math.min(chapters.length - 1, curChapterIdx + dir));
    const ch = chapters[target];
    if (ch) seek(ch.start_s);
  };

  if (!entitled) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Lock className="h-5 w-5 shrink-0" />
        <p>{t("premiumLocked")}</p>
      </div>
    );
  }
  if (!audioUrl) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t("comingSoon")}
      </div>
    );
  }

  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <div
      className="space-y-3 rounded-lg border border-border bg-background/60 p-4"
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          void toggle();
        }
      }}
    >
      <audio
        ref={ref}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={onLoaded}
        onTimeUpdate={onTime}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          save(true);
        }}
      />

      {/* Scrubber (WCAG: labelled slider with a spoken time value) */}
      <div className="flex items-center gap-2">
        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
          {fmt(cur)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(dur))}
          value={Math.round(cur)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t("seek")}
          aria-valuetext={`${fmt(cur)} / ${fmt(dur)}`}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)`,
          }}
        />
        <span className="w-12 text-xs tabular-nums text-muted-foreground">
          {fmt(dur)}
        </span>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-2">
        {chapters.length > 0 && (
          <Button variant="outline" size="icon" onClick={() => jumpChapter(-1)} aria-label={t("prevChapter")}>
            <SkipBack className="h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" size="icon" onClick={() => nudge(-15)} aria-label={t("back15")}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="icon" className="h-12 w-12" onClick={toggle} aria-label={playing ? t("pause") : t("play")}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button variant="outline" size="icon" onClick={() => nudge(15)} aria-label={t("fwd15")}>
          <RotateCw className="h-4 w-4" />
        </Button>
        {chapters.length > 0 && (
          <Button variant="outline" size="icon" onClick={() => jumpChapter(1)} aria-label={t("nextChapter")}>
            <SkipForward className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Secondary controls */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1)}
          aria-label={t("speed")}
        >
          {speed}×
        </Button>

        <div className="relative">
          <Button
            variant={sleepMin != null ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSleep((v) => !v)}
          >
            <Moon className="mr-1 h-4 w-4" />
            {sleepMin == null
              ? t("sleepTimer")
              : sleepMin === "chapter"
                ? t("sleepEndChapter")
                : t("min", { n: sleepMin })}
          </Button>
          {showSleep && (
            <div className="absolute bottom-full left-0 z-10 mb-1 w-40 rounded-lg border border-border bg-background p-1 shadow-lg">
              {SLEEP_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setSleepMin(m);
                    setShowSleep(false);
                  }}
                >
                  {t("min", { n: m })}
                </button>
              ))}
              {chapters.length > 0 && (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setSleepMin("chapter");
                    setShowSleep(false);
                  }}
                >
                  {t("sleepEndChapter")}
                </button>
              )}
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setSleepMin(null);
                  setShowSleep(false);
                }}
              >
                {t("sleepOff")}
              </button>
            </div>
          )}
        </div>

        {chapters.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowChapters((v) => !v)}>
            <ListMusic className="mr-1 h-4 w-4" />
            {t("chapters")}
          </Button>
        )}
      </div>

      {/* Chapter list */}
      {showChapters && chapters.length > 0 && (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => seek(c.start_s)}
                aria-current={i === curChapterIdx}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                  i === curChapterIdx ? "bg-muted font-medium" : ""
                }`}
              >
                <span className="truncate">
                  {i + 1}. {c.title}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {fmt(c.start_s)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
