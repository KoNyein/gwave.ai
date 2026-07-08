"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import {
  LIVE_REACTION_EMOJIS,
  type LiveReactionEmoji,
} from "@/types/database";

interface Floater {
  key: number;
  emoji: string;
  left: number;
}

/**
 * Facebook-Live-style tap reactions. Broadcast delivers them to every viewer
 * instantly (including the sender via self: true); a row is also written to
 * live_reactions for counts. Floating emoji animate up and fade out.
 */
export function ReactionBar({
  streamId,
  userId,
  disabled,
}: {
  streamId: string;
  userId: string;
  disabled?: boolean;
}) {
  const [floaters, setFloaters] = React.useState<Floater[]>([]);
  const nextKey = React.useRef(0);
  const channelRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const spawn = React.useCallback((emoji: string) => {
    const key = nextKey.current++;
    setFloaters((prev) => [
      // Keep the list bounded even under a reaction storm.
      ...prev.slice(-30),
      { key, emoji, left: 10 + Math.random() * 80 },
    ]);
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.key !== key));
    }, 2500);
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-reactions:${streamId}`, {
      config: { broadcast: { self: true } },
    });
    channel
      .on("broadcast", { event: "reaction" }, (payload) => {
        const emoji = payload.payload?.emoji;
        if (typeof emoji === "string") spawn(emoji);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [streamId, spawn]);

  function react(emoji: LiveReactionEmoji) {
    if (disabled) return;
    void channelRef.current?.send({
      type: "broadcast",
      event: "reaction",
      payload: { emoji },
    });
    // Fire-and-forget persistence for counts/analytics.
    const supabase = createClient();
    void supabase
      .from("live_reactions")
      .insert({ stream_id: streamId, user_id: userId, emoji })
      .then(({ error }) => {
        if (error) console.warn("Reaction save failed:", error.message);
      });
  }

  return (
    <div className="relative">
      {/* Floating layer */}
      <div
        className="pointer-events-none absolute bottom-full left-0 right-0 h-40 overflow-hidden"
        aria-hidden
      >
        {floaters.map((floater) => (
          <span
            key={floater.key}
            className="absolute bottom-0 animate-float-up text-2xl"
            style={{ left: `${floater.left}%` }}
          >
            {floater.emoji}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LIVE_REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => react(emoji)}
            disabled={disabled}
            className="rounded-full border bg-background px-2.5 py-1 text-lg transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
            aria-label={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
