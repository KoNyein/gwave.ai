"use client";

import * as React from "react";
import { Heart } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

interface Burst {
  key: number;
  x: number;
  y: number;
}

/**
 * TikTok-style double-tap (or double-click) anywhere on the video to send a ❤️.
 * A heart pops where you tapped, and the reaction is broadcast on the same
 * channel the ReactionBar listens to (so it floats up for everyone) and saved
 * for analytics.
 */
export function DoubleTapHeart({
  streamId,
  userId,
  disabled,
}: {
  streamId: string;
  userId: string;
  disabled?: boolean;
}) {
  const [bursts, setBursts] = React.useState<Burst[]>([]);
  const nextKey = React.useRef(0);
  const channelRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-reactions:${streamId}`, {
      config: { broadcast: { self: true } },
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [streamId]);

  function sendHeart(clientX: number, clientY: number, rect: DOMRect) {
    if (disabled) return;
    const key = nextKey.current++;
    setBursts((prev) => [
      ...prev.slice(-12),
      { key, x: clientX - rect.left, y: clientY - rect.top },
    ]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.key !== key)), 900);

    void channelRef.current?.send({
      type: "broadcast",
      event: "reaction",
      payload: { emoji: "❤️" },
    });
    const supabase = createClient();
    void supabase
      .from("live_reactions")
      .insert({ stream_id: streamId, user_id: userId, emoji: "❤️" })
      .then(() => undefined);
  }

  return (
    <div
      className="absolute inset-0 z-10"
      onDoubleClick={(e) =>
        sendHeart(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
      }
      aria-hidden
    >
      {bursts.map((b) => (
        <Heart
          key={b.key}
          className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 animate-ping fill-rose-500 text-rose-500"
          style={{ left: b.x, top: b.y, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}
