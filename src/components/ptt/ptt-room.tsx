"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Play, Radio, WifiOff } from "lucide-react";

import { sendPttMessage } from "@/lib/actions/ptt";
import { mediaUrl, uploadVoice } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { PttMessageWithPerson } from "@/lib/db/ptt";

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
    (t) => MediaRecorder.isTypeSupported?.(t),
  );
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * A walkie-talkie room: press and hold the big button to record; release to
 * send. New messages from other members auto-play, and the whole exchange stays
 * in the list to replay. Queues a send and retries when the connection returns.
 */
export function PttRoom({
  channelId,
  myUserId,
  initialMessages,
}: {
  channelId: string;
  myUserId: string;
  initialMessages: PttMessageWithPerson[];
}) {
  const router = useRouter();
  const [recording, setRecording] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [online, setOnline] = React.useState(true);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedRef = React.useRef(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  // Sends waiting for the network to come back.
  const queueRef = React.useRef<{ blob: Blob; durationMs: number }[]>([]);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void flushQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: auto-play voices from others and refresh the list.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ptt:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ptt_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as {
            user_id: string;
            audio_path: string;
          };
          if (row.user_id !== myUserId) {
            const el = audioRef.current ?? new Audio();
            audioRef.current = el;
            el.src = mediaUrl(row.audio_path);
            void el.play().catch(() => undefined);
          }
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, myUserId, router]);

  async function deliver(blob: Blob, durationMs: number) {
    const { storage_path } = await uploadVoice(myUserId, blob);
    const res = await sendPttMessage({
      channelId,
      audioPath: storage_path,
      durationMs,
    });
    if (!res.ok) throw new Error(res.error);
    router.refresh();
  }

  async function flushQueue() {
    const pending = queueRef.current.splice(0, queueRef.current.length);
    for (const item of pending) {
      try {
        await deliver(item.blob, item.durationMs);
      } catch {
        queueRef.current.push(item); // put back; retry next time
      }
    }
  }

  async function startRecording() {
    if (recording || sending) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationMs = Date.now() - startedRef.current;
        const blob = new Blob(chunksRef.current, {
          type: mime?.split(";")[0] ?? "audio/webm",
        });
        if (blob.size === 0) return;
        // Too short to be intentional — ignore taps.
        if (durationMs < 400) return;
        setSending(true);
        try {
          if (navigator.onLine) {
            await deliver(blob, durationMs);
          } else {
            queueRef.current.push({ blob, durationMs });
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Send failed.");
          queueRef.current.push({ blob, durationMs });
        } finally {
          setSending(false);
        }
      };
      recorderRef.current = recorder;
      startedRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone permission is needed to talk.");
    }
  }

  function stopRecording() {
    if (!recording) return;
    setRecording(false);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  return (
    <div className="space-y-4">
      {/* Message history */}
      <ul className="space-y-2">
        {initialMessages.length === 0 ? (
          <li className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            အသံ မရှိသေးပါ — ခလုတ်ကို ဖိပြီး ပြောကြည့်ပါ။
          </li>
        ) : (
          initialMessages.map((m) => {
            const mine = m.user_id === myUserId;
            return (
              <li
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                    mine ? "bg-primary/10" : "bg-muted"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const el = audioRef.current ?? new Audio();
                      audioRef.current = el;
                      el.src = mediaUrl(m.audio_path);
                      void el.play().catch(() => undefined);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    aria-label="ဖွင့်"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <div className="text-xs">
                    <p className="font-medium">
                      {mine
                        ? "ကျွန်တော်"
                        : m.person.full_name || m.person.username || "Member"}
                    </p>
                    <p className="text-muted-foreground">
                      {m.duration_ms
                        ? `${Math.round(m.duration_ms / 1000)}s · `
                        : ""}
                      {timeLabel(m.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {error ? <p className="text-sm text-destructive">❌ {error}</p> : null}
      {!online ? (
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <WifiOff className="h-3 w-3" /> Offline — net ပြန်ရရင် အလိုအလျောက် ပို့မယ်
          {queueRef.current.length > 0 ? ` (${queueRef.current.length})` : ""}
        </p>
      ) : null}

      {/* Push-to-talk button */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          onContextMenu={(e) => e.preventDefault()}
          disabled={sending}
          className={`flex h-24 w-24 select-none items-center justify-center rounded-full text-white shadow-lg transition-transform ${
            recording
              ? "scale-110 bg-destructive"
              : "bg-primary active:scale-95"
          } disabled:opacity-60`}
        >
          {sending ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : recording ? (
            <Radio className="h-8 w-8 animate-pulse" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </button>
        <p className="text-sm font-medium text-muted-foreground">
          {recording ? "ပြောနေသည်… လွှတ်လိုက်ရင် ပို့မယ်" : "ဖိထားပြီး ပြောပါ"}
        </p>
      </div>
    </div>
  );
}
