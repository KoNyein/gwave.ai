"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";

import { formatDuration } from "@/components/messenger/voice-recorder";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const BARS = 40;
const SPEEDS = [1, 1.5, 2] as const;

/**
 * Peaks for the waveform, computed from the decoded audio the first time it
 * plays. We don't store peaks with the message, and decoding on mount would
 * download every clip in the thread just to draw it — so until then the bars
 * sit flat and the player still works as a seek bar.
 */
async function loadPeaks(url: string): Promise<number[]> {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return [];

  const ctx = new AudioCtx();
  try {
    const buffer = await ctx.decodeAudioData(
      await (await fetch(url)).arrayBuffer(),
    );
    const samples = buffer.getChannelData(0);
    const per = Math.floor(samples.length / BARS) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < BARS; i += 1) {
      let peak = 0;
      for (let j = i * per; j < (i + 1) * per && j < samples.length; j += 1) {
        const v = Math.abs(samples[j] ?? 0);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
    }
    const loudest = Math.max(...peaks, 0.01);
    return peaks.map((p) => p / loudest); // normalise so quiet clips still read
  } catch {
    return [];
  } finally {
    void ctx.close().catch(() => {});
  }
}

/**
 * A voice note bubble: play/pause, a waveform you can scrub, and a playback
 * speed toggle. `duration` comes from the message row, so the length shows
 * before a single byte of audio is fetched.
 */
export function VoiceMessage({
  path,
  duration,
  mine,
}: {
  path: string;
  duration: number;
  mine: boolean;
}) {
  const url = React.useMemo(() => mediaUrl(path), [path]);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const peaksLoadedRef = React.useRef(false);

  const [playing, setPlaying] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [speed, setSpeed] = React.useState<(typeof SPEEDS)[number]>(1);
  const [peaks, setPeaks] = React.useState<number[]>([]);

  // The stored duration is authoritative until the element reports its own —
  // some browsers report Infinity for streamed WebM until it has fully loaded.
  const [actual, setActual] = React.useState<number | null>(null);
  const total = actual ?? duration;
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    void audio.play().catch(() => setPlaying(false));
    if (!peaksLoadedRef.current) {
      peaksLoadedRef.current = true;
      setPeaks(await loadPeaks(url));
    }
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  /** Scrub by tapping anywhere on the waveform. */
  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || total <= 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    audio.currentTime = ratio * total;
    setElapsed(ratio * total);
  }

  return (
    <div className="flex w-56 items-center gap-2.5 sm:w-64">
      <audio
        ref={audioRef}
        src={url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setElapsed(0);
        }}
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setActual(d);
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
          mine
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30"
            : "bg-primary/10 text-primary hover:bg-primary/20",
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          onClick={seek}
          role="presentation"
          className="flex h-7 cursor-pointer items-center gap-[2px]"
        >
          {Array.from({ length: BARS }, (_, i) => {
            const peak = peaks[i];
            const height = peak == null ? 0.32 : Math.max(0.12, peak);
            const played = i / BARS < progress;
            return (
              <span
                key={i}
                style={{ height: `${height * 100}%` }}
                className={cn(
                  "w-[2px] flex-1 rounded-full transition-colors",
                  played
                    ? mine
                      ? "bg-primary-foreground"
                      : "bg-primary"
                    : mine
                      ? "bg-primary-foreground/35"
                      : "bg-primary/25",
                )}
              />
            );
          })}
        </div>

        <div
          className={cn(
            "flex items-center justify-between text-[11px] tabular-nums",
            mine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <span>{formatDuration(playing || elapsed > 0 ? elapsed : total)}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label="Change playback speed"
            className={cn(
              "rounded px-1 font-medium hover:underline",
              speed !== 1 && (mine ? "text-primary-foreground" : "text-primary"),
            )}
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}
