"use client";

import MuxPlayer from "@mux/mux-player-react";
import { Radio } from "lucide-react";

import type { LiveStreamStatus } from "@/types/database";

/**
 * Mux HLS player with idle/ended placeholders. Ended streams with an auto-saved
 * recording (vod_playback_id, filled by the Mux webhook when the asset is
 * ready) play the replay instead of a dead-end placeholder.
 */
export function LivePlayer({
  playbackId,
  vodPlaybackId,
  status,
  title,
}: {
  playbackId: string | null;
  vodPlaybackId?: string | null;
  status: LiveStreamStatus;
  title: string;
}) {
  if (status === "ended") {
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

  if (status === "idle" || !playbackId) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted text-muted-foreground">
        <Radio className="h-8 w-8 animate-pulse" />
        <p className="text-sm font-medium">Waiting for the broadcast to start…</p>
        <p className="text-xs">This page updates automatically.</p>
      </div>
    );
  }

  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="live"
      autoPlay="muted"
      metadata={{ video_title: title }}
      className="aspect-video w-full overflow-hidden rounded-xl"
      accentColor="#3B6D11"
    />
  );
}
