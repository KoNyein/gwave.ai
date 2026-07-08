"use client";

import MuxPlayer from "@mux/mux-player-react";
import { Radio } from "lucide-react";

import type { LiveStreamStatus } from "@/types/database";

/** Mux HLS player with idle/ended placeholders. */
export function LivePlayer({
  playbackId,
  status,
  title,
}: {
  playbackId: string | null;
  status: LiveStreamStatus;
  title: string;
}) {
  if (status === "idle" || !playbackId) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted text-muted-foreground">
        <Radio className="h-8 w-8 animate-pulse" />
        <p className="text-sm font-medium">Waiting for the broadcast to start…</p>
        <p className="text-xs">This page updates automatically.</p>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted text-muted-foreground">
        <p className="text-sm font-medium">This broadcast has ended.</p>
        <p className="text-xs">Thanks for watching!</p>
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
