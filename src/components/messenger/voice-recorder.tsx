"use client";

import * as React from "react";
import { Loader2, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_VOICE_SECONDS } from "@/lib/media";
import { cn } from "@/lib/utils";

/** Bars drawn in the live meter; oldest scrolls off the left. */
const METER_BARS = 34;

/**
 * The container to record into. Chrome, Firefox and Android give us Opus in a
 * WebM container — small and universally decodable. Safari (iOS included) has
 * no WebM encoder and only offers MP4/AAC, so ask for that second. Passing an
 * unsupported mimeType to MediaRecorder throws, so probe before constructing.
 */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The composer's recording state: starts capturing as soon as it mounts (the
 * user already tapped the mic), shows a live level meter and a timer, and hands
 * the finished clip back. Recording is capped so a phone left in a pocket can't
 * upload an hour of noise.
 */
export function VoiceRecorder({
  onSend,
  onCancel,
  onError,
  busy,
}: {
  onSend: (blob: Blob, seconds: number) => void;
  onCancel: () => void;
  onError: (message: string) => void;
  busy?: boolean;
}) {
  const [seconds, setSeconds] = React.useState(0);
  const [levels, setLevels] = React.useState<number[]>([]);
  const [ready, setReady] = React.useState(false);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const secondsRef = React.useRef(0);
  // Set when the user discards, so the recorder's stop handler knows to throw
  // the audio away instead of sending it.
  const cancelledRef = React.useRef(false);
  const frameRef = React.useRef<number | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  // Keep the newest callbacks without restarting the recorder on every render.
  const onSendRef = React.useRef(onSend);
  const onErrorRef = React.useRef(onError);
  onSendRef.current = onSend;
  onErrorRef.current = onError;

  const teardown = React.useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    // Stop the tracks or the browser keeps showing the "recording" indicator.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  React.useEffect(() => {
    let disposed = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined,
        );
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          teardown();
          if (cancelledRef.current) return;
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          // Sub-second taps are almost always a misfire, and the DB requires a
          // duration of at least 1 second.
          const secs = Math.max(1, Math.round(secondsRef.current));
          if (blob.size === 0) {
            onErrorRef.current("Recording failed — nothing was captured.");
            return;
          }
          onSendRef.current(blob, secs);
        };
        recorder.start(250);
        setReady(true);

        // Live level meter, straight off the mic.
        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const buffer = new Uint8Array(analyser.frequencyBinCount);
          let lastPush = 0;

          const tick = (now: number) => {
            analyser.getByteTimeDomainData(buffer);
            // RMS around the 128 midpoint → 0..1 loudness.
            let sum = 0;
            for (const v of buffer) {
              const centred = (v - 128) / 128;
              sum += centred * centred;
            }
            const rms = Math.sqrt(sum / buffer.length);
            if (now - lastPush > 90) {
              lastPush = now;
              setLevels((prev) =>
                [...prev, Math.min(1, rms * 3)].slice(-METER_BARS),
              );
            }
            frameRef.current = requestAnimationFrame(tick);
          };
          frameRef.current = requestAnimationFrame(tick);
        }
      } catch {
        onErrorRef.current(
          "Microphone permission is needed to record a voice message.",
        );
        onCancel();
      }
    }

    void start();
    return () => {
      disposed = true;
      // Unmounting mid-recording (conversation switched, dialog closed) must not
      // fire onSend — the user never asked to send this.
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      teardown();
    };
    // Deliberately runs once: the recorder owns the mic for its whole lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= MAX_VOICE_SECONDS) {
        recorderRef.current?.stop();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready]);

  function send() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop(); // onstop hands the blob to the parent
    }
  }

  function cancel() {
    cancelledRef.current = true;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    teardown();
    onCancel();
  }

  const remaining = MAX_VOICE_SECONDS - seconds;

  return (
    <div className="flex flex-1 items-center gap-2 rounded-full border bg-background px-3 py-1.5">
      <button
        type="button"
        onClick={cancel}
        aria-label="Discard voice message"
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
      <span className="shrink-0 font-mono text-xs tabular-nums">
        {formatDuration(seconds)}
      </span>

      <div className="flex h-6 flex-1 items-center gap-[2px] overflow-hidden">
        {levels.map((level, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full bg-primary/70"
            style={{ height: `${Math.max(10, level * 100)}%` }}
          />
        ))}
      </div>

      {remaining <= 30 ? (
        <span
          className={cn(
            "shrink-0 text-[11px] tabular-nums",
            remaining <= 10 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {formatDuration(remaining)}
        </span>
      ) : null}

      <Button
        type="button"
        size="icon"
        onClick={send}
        disabled={busy || !ready}
        aria-label="Send voice message"
        className="h-8 w-8 shrink-0 rounded-full"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
