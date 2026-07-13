"use client";

import * as React from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CallApi, CallStatus } from "./use-call";

/**
 * Plays a ringtone while a call is ringing — a repeating dual-tone for an
 * incoming call, a slower single-tone ringback for an outgoing one — using the
 * Web Audio API so no audio asset is needed. Stops as soon as the call is
 * answered, ends, or the component unmounts.
 */
function useCallRingtone(status: CallStatus): void {
  React.useEffect(() => {
    if (status !== "incoming" && status !== "outgoing") return;

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    let ctx: AudioContext | null = null;
    let stopped = false;
    try {
      ctx = new AudioCtx();
    } catch {
      return;
    }
    const audioCtx = ctx;

    const beep = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.04);
      gain.gain.setValueAtTime(0.18, start + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    const ring = () => {
      if (stopped) return;
      const now = audioCtx.currentTime;
      if (status === "incoming") {
        beep(480, now, 0.4);
        beep(440, now + 0.5, 0.4);
      } else {
        beep(440, now, 1.0);
      }
    };

    audioCtx.resume().catch(() => {});
    ring();
    const interval = window.setInterval(
      ring,
      status === "incoming" ? 1600 : 3200,
    );

    return () => {
      stopped = true;
      window.clearInterval(interval);
      audioCtx.close().catch(() => {});
    };
  }, [status]);
}

function MediaStreamVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Incoming-call banner + in-call overlay, driven entirely by useCall(). */
export function CallUI({ call }: { call: CallApi }) {
  const t = useTranslations("messenger");

  // Ring while the call is ringing (incoming/outgoing).
  useCallRingtone(call.status);

  // Pop a system notification for an incoming call (helps when the tab is in
  // the background). Requires the notification permission the PWA already asks
  // for; silently no-ops otherwise.
  const peer = call.peer;
  const incomingVideo = call.status === "incoming" ? call.video : false;
  React.useEffect(() => {
    if (call.status !== "incoming" || !peer) return;
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    let notification: Notification | null = null;
    try {
      notification = new Notification(displayName(peer), {
        body: incomingVideo ? t("incomingVideoCall") : t("incomingAudioCall"),
        tag: "gwave-incoming-call",
        renotify: true,
      } as NotificationOptions & { renotify?: boolean });
    } catch {
      notification = null;
    }
    return () => notification?.close();
  }, [call.status, peer, incomingVideo, t]);

  if (call.status === "idle" || !call.peer) return null;

  // Ringing on our side — accept / decline banner.
  if (call.status === "incoming") {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border bg-background p-4 shadow-xl">
        <UserAvatar profile={call.peer} linked={false} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{displayName(call.peer)}</p>
          <p className="text-sm text-muted-foreground">
            {call.video ? t("incomingVideoCall") : t("incomingAudioCall")}
          </p>
        </div>
        <Button
          size="icon"
          variant="destructive"
          className="rounded-full"
          onClick={call.decline}
          aria-label={t("decline")}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="rounded-full bg-green-600 hover:bg-green-700"
          onClick={call.accept}
          aria-label={t("accept")}
        >
          {call.video ? (
            <Video className="h-5 w-5" />
          ) : (
            <Phone className="h-5 w-5" />
          )}
        </Button>
      </div>
    );
  }

  const hasRemoteVideo =
    call.video && (call.remoteStream?.getVideoTracks().length ?? 0) > 0;
  const statusLine =
    call.status === "outgoing"
      ? t("ringing")
      : call.status === "connecting"
        ? t("connecting")
        : formatDuration(call.duration);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
      {/* Remote media (audio plays through the video element too) */}
      <div className="relative flex-1">
        <MediaStreamVideo
          stream={call.remoteStream}
          className={cn(
            "h-full w-full object-contain",
            !hasRemoteVideo && "hidden",
          )}
        />
        {!hasRemoteVideo ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <UserAvatar
              profile={call.peer}
              linked={false}
              className="h-24 w-24"
            />
          </div>
        ) : null}

        {/* Peer name + status */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4 text-center">
          <p className="text-lg font-semibold">{displayName(call.peer)}</p>
          <p className="text-sm text-white/80">{statusLine}</p>
        </div>

        {/* Local preview (video calls) */}
        {call.video && call.localStream ? (
          <MediaStreamVideo
            stream={call.localStream}
            muted
            className={cn(
              "absolute bottom-4 right-4 h-40 w-28 rounded-xl border border-white/30 object-cover shadow-lg",
              call.cameraOff && "opacity-30",
            )}
          />
        ) : null}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-5">
        <Button
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full"
          onClick={call.toggleMute}
          aria-label={call.muted ? t("unmute") : t("mute")}
        >
          {call.muted ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
        {call.video ? (
          <Button
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full"
            onClick={call.toggleCamera}
            aria-label={call.cameraOff ? t("cameraOn") : t("cameraOff")}
          >
            {call.cameraOff ? (
              <VideoOff className="h-5 w-5" />
            ) : (
              <Video className="h-5 w-5" />
            )}
          </Button>
        ) : null}
        <Button
          size="icon"
          variant="destructive"
          className="h-14 w-14 rounded-full"
          onClick={call.hangUp}
          aria-label={t("endCall")}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
