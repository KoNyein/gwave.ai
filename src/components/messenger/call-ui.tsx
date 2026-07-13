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

import type { CallApi } from "./use-call";
import { useRingtone } from "./use-ringtone";

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
  // Ring the callee (and ringback the caller) while the call is pending.
  useRingtone(call.status, call.peer ? displayName(call.peer) : null, call.video);

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
