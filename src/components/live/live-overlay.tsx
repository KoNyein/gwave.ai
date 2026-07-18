"use client";

import * as React from "react";

import { displayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { LiveChatMessage } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

interface OverlayMessage {
  id: string;
  name: string;
  content: string;
}

interface Floater {
  key: number;
  emoji: string;
  left: number;
}

/**
 * TikTok/FB-Live-style on-video layer: the latest chat messages fade in over
 * the bottom of the video (each expiring after a while), and reactions float
 * up over the picture for every viewer. Purely presentational — sending still
 * happens in LiveChat / ReactionBar / DoubleTapHeart; this listens on the same
 * postgres_changes + broadcast channels they already use.
 */
export function LiveOverlay({
  streamId,
  currentUser,
}: {
  streamId: string;
  currentUser: AuthorSummary;
}) {
  const [messages, setMessages] = React.useState<OverlayMessage[]>([]);
  const [floaters, setFloaters] = React.useState<Floater[]>([]);
  const nextKey = React.useRef(0);
  const profileCache = React.useRef(new Map<string, AuthorSummary>());

  const spawnFloater = React.useCallback((emoji: string) => {
    const key = nextKey.current++;
    setFloaters((prev) => [
      // Bounded even under a reaction storm.
      ...prev.slice(-40),
      { key, emoji, left: 55 + Math.random() * 38 },
    ]);
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.key !== key));
    }, 2600);
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    profileCache.current.set(currentUser.id, currentUser);

    // New chat messages → show over the video, expire after 9s (keep last 4).
    const chat = supabase
      .channel(`live-overlay-chat:${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const row = payload.new as LiveChatMessage;
          let author = profileCache.current.get(row.user_id);
          if (!author) {
            const { data } = await supabase
              .from("profiles")
              .select("id, username, full_name, avatar_url")
              .eq("id", row.user_id)
              .maybeSingle();
            author = data ?? {
              id: row.user_id,
              username: null,
              full_name: null,
              avatar_url: null,
            };
            profileCache.current.set(row.user_id, author);
          }
          const entry: OverlayMessage = {
            id: row.id,
            name: displayName(author),
            content: row.content,
          };
          setMessages((prev) =>
            prev.some((m) => m.id === entry.id)
              ? prev
              : [...prev.slice(-3), entry],
          );
          setTimeout(() => {
            setMessages((prev) => prev.filter((m) => m.id !== entry.id));
          }, 9000);
        },
      )
      .subscribe();

    // Reactions (ReactionBar + DoubleTapHeart broadcast on this channel).
    const reactions = supabase.channel(`live-reactions:${streamId}`, {
      config: { broadcast: { self: true } },
    });
    reactions
      .on("broadcast", { event: "reaction" }, (payload) => {
        const emoji = payload.payload?.emoji;
        if (typeof emoji === "string") spawnFloater(emoji);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(chat);
      void supabase.removeChannel(reactions);
    };
  }, [streamId, currentUser, spawnFloater]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl">
      {/* Floating reactions rise over the right side of the picture. */}
      <div aria-hidden className="absolute inset-0">
        {floaters.map((floater) => (
          <span
            key={floater.key}
            className="absolute bottom-6 animate-float-up text-3xl drop-shadow"
            style={{ left: `${floater.left}%` }}
          >
            {floater.emoji}
          </span>
        ))}
      </div>

      {/* Latest chat, bottom-left, over a readability scrim. */}
      {messages.length > 0 ? (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent p-3 pt-10">
          <ul className="flex max-w-[85%] flex-col gap-1 sm:max-w-[60%]">
            {messages.map((m) => (
              <li
                key={m.id}
                className="w-fit max-w-full rounded-full bg-black/45 px-3 py-1 text-xs text-white backdrop-blur-sm"
              >
                <span className="mr-1 font-semibold text-white/90">
                  {m.name}
                </span>
                <span className="break-words">{m.content}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
