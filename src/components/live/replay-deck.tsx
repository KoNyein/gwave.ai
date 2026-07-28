"use client";

import * as React from "react";
import MuxPlayer from "@mux/mux-player-react";
import { ChevronDown, ChevronUp, Play } from "lucide-react";

/**
 * TikTok-style replay pager: plays the current replay and, when it ends (or
 * the viewer swipes up / taps next), swaps the next saved replay into the SAME
 * media element — no remount, so the element keeps its playback authorization
 * and the next video can continue with sound. If the browser still blocks the
 * end-driven play() (no recent gesture), a tap-to-continue overlay appears
 * instead of failing silently. The URL is updated with history.replaceState so
 * refresh/share still lands on what's on screen, but the surrounding page
 * (chat history, gifts, header) intentionally stays on the stream the viewer
 * opened.
 */
export interface ReplayDeckItem {
  id: string;
  title: string;
  src: string;
  hostName: string;
}

export function ReplayDeck({
  items,
  startId,
}: {
  items: ReplayDeckItem[];
  startId: string;
}) {
  const start = Math.max(
    0,
    items.findIndex((x) => x.id === startId),
  );
  const [index, setIndex] = React.useState(start);
  // Autoplay blocked on an advance → show a tap-to-continue overlay.
  const [blocked, setBlocked] = React.useState(false);
  const playerRef = React.useRef<React.ComponentRef<typeof MuxPlayer> | null>(
    null,
  );
  // Set when go() advances the deck; consumed once the new source's metadata
  // is ready, so play() isn't fired mid-load (an AbortError would read as
  // "blocked").
  const pendingPlay = React.useRef(false);
  const touchY = React.useRef<number | null>(null);

  const cur = items[index];
  const hasNext = index + 1 < items.length;
  const hasPrev = index > 0;

  const go = (next: number) => {
    if (next < 0 || next >= items.length) return;
    pendingPlay.current = true;
    setBlocked(false);
    setIndex(next);
    const target = items[next];
    if (target && typeof window !== "undefined") {
      window.history.replaceState(null, "", `/live/${target.id}`);
    }
  };

  const tryResume = () => {
    const p = playerRef.current;
    if (!p) return;
    const attempt = p.play?.();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => setBlocked(true));
    }
  };

  if (!cur) return null;

  return (
    <div
      className="relative"
      onTouchStart={(e) => {
        touchY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        const startY = touchY.current;
        touchY.current = null;
        const endY = e.changedTouches[0]?.clientY;
        if (startY == null || endY == null) return;
        const dy = startY - endY;
        if (dy > 70) go(index + 1); // swipe up → next replay
        else if (dy < -70) go(index - 1); // swipe down → previous
      }}
    >
      <span className="absolute left-3 top-3 z-20 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
        Replay
      </span>
      <MuxPlayer
        ref={playerRef}
        src={cur.src}
        streamType="on-demand"
        onLoadedMetadata={() => {
          if (!pendingPlay.current) return;
          pendingPlay.current = false;
          tryResume();
        }}
        onEnded={() => {
          if (hasNext) go(index + 1);
        }}
        metadata={{ video_title: cur.title }}
        className="aspect-video w-full overflow-hidden rounded-xl"
        accentColor="#3B6D11"
      />

      {/* Which replay is on screen (changes as the deck advances). */}
      <div className="pointer-events-none absolute bottom-14 left-3 z-20 max-w-[70%] rounded-full bg-black/60 px-3 py-1">
        <p className="truncate text-xs font-semibold text-white">
          {cur.hostName} — {cur.title}
        </p>
      </div>

      {/* Autoplay was blocked on an auto-advance — one tap continues. */}
      {blocked ? (
        <button
          type="button"
          onClick={() => {
            setBlocked(false);
            tryResume();
          }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/40"
        >
          <span className="flex items-center gap-2 rounded-full bg-black/75 px-5 py-3 text-sm font-bold text-white shadow-lg">
            <Play className="h-4 w-4" /> ဆက်ကြည့်ရန် နှိပ်ပါ
          </span>
        </button>
      ) : null}

      {/* Next / previous — desktop gets buttons, phones can also swipe. */}
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
        {hasPrev ? (
          <button
            type="button"
            aria-label="Previous replay"
            onClick={() => go(index - 1)}
            className="rounded-full bg-black/60 p-2 text-white shadow transition-colors hover:bg-black/80"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        ) : null}
        {hasNext ? (
          <button
            type="button"
            aria-label="Next replay"
            onClick={() => go(index + 1)}
            className="rounded-full bg-black/60 p-2 text-white shadow transition-colors hover:bg-black/80"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
