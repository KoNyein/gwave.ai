"use client";

import * as React from "react";
import MuxPlayer from "@mux/mux-player-react";
import { Radio, Volume2 } from "lucide-react";

import type { LiveStreamStatus } from "@/types/database";

/**
 * HLS player with idle/ended placeholders. Plays a Mux playbackId, or any raw
 * HLS URL via `src` (used for Amazon IVS channels — MuxPlayer is a generic HLS
 * player under the hood). Ended streams with an auto-saved recording play the
 * replay instead of a dead-end placeholder.
 */
export function LivePlayer({
  playbackId,
  vodPlaybackId,
  status,
  title,
  src,
  vodSrc,
}: {
  playbackId: string | null;
  vodPlaybackId?: string | null;
  status: LiveStreamStatus;
  title: string;
  /** Raw HLS URL (IVS playback). Takes precedence over playbackId while live. */
  src?: string | null;
  /** Raw HLS replay URL (IVS recordings are HLS; a bare <video> can't play
   * m3u8 on Chrome). Takes precedence over vodPlaybackId when ended. */
  vodSrc?: string | null;
}) {
  // Live playback must autoplay muted (browser policy), which viewers read as
  // "live has no sound". Surface an explicit unmute button until tapped.
  // (ComponentRef: @mux/mux-player itself isn't a direct dependency, only the
  // React wrapper is, so the element type can't be imported by name.)
  const liveRef = React.useRef<React.ComponentRef<typeof MuxPlayer> | null>(
    null,
  );
  const [needsUnmute, setNeedsUnmute] = React.useState(true);

  if (status === "ended") {
    if (vodSrc) {
      return (
        <div className="relative">
          <span className="absolute left-3 top-3 z-20 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Replay
          </span>
          <MuxPlayer
            src={vodSrc}
            streamType="on-demand"
            metadata={{ video_title: title }}
            className="aspect-video w-full overflow-hidden rounded-xl"
            accentColor="#3B6D11"
          />
        </div>
      );
    }
    if (vodPlaybackId) {
      return (
        <div className="relative">
          <span className="absolute left-3 top-3 z-20 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Replay
          </span>
          <MuxPlayer
            playbackId={vodPlaybackId}
            streamType="on-demand"
            metadata={{ video_title: title }}
            className="aspect-video w-full overflow-hidden rounded-xl"
            accentColor="#3B6D11"
          />
        </div>
      );
    }
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted text-muted-foreground">
        <p className="text-sm font-medium">This broadcast has ended.</p>
        <p className="text-xs">The replay appears here once it finishes saving.</p>
      </div>
    );
  }

  if (status === "idle" || (!playbackId && !src)) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted text-muted-foreground">
        <Radio className="h-8 w-8 animate-pulse" />
        <p className="text-sm font-medium">Waiting for the broadcast to start…</p>
        <p className="text-xs">This page updates automatically.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <MuxPlayer
        ref={liveRef}
        {...(src ? { src } : { playbackId: playbackId ?? undefined })}
        streamType="live"
        autoPlay="muted"
        onVolumeChange={() => {
          // Viewer unmuted via the player's own controls — drop the overlay.
          if (liveRef.current && !liveRef.current.muted) setNeedsUnmute(false);
        }}
        metadata={{ video_title: title }}
        className="aspect-video w-full overflow-hidden rounded-xl"
        accentColor="#3B6D11"
      />
      {needsUnmute ? (
        <button
          type="button"
          onClick={() => {
            const p = liveRef.current;
            if (p) {
              p.muted = false;
              p.volume = 1;
              void p.play()?.catch(() => undefined);
            }
            setNeedsUnmute(false);
          }}
          className="absolute bottom-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur transition-colors hover:bg-black/85"
        >
          <Volume2 className="h-4 w-4" /> အသံဖွင့်ရန် နှိပ်ပါ
        </button>
      ) : null}
    </div>
  );
}
