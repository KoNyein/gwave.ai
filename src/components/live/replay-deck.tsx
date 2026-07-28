"use client";

import * as React from "react";
import MuxPlayer from "@mux/mux-player-react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * TikTok-style replay pager: plays the current replay and, when it ends (or
 * the viewer swipes up / taps next), swaps in the next saved replay in place —
 * no page navigation, so the "user already tapped play" gesture carries over
 * and the next video autoplays with sound. The URL is updated with
 * history.replaceState so refresh/share still lands on what's on screen, but
 * the surrounding page (chat history, gifts, header) intentionally stays on
 * the stream the viewer opened.
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
  // Only autoplay after the viewer has interacted (ended/swipe/next) — the
  // first video keeps the normal big-play-button behavior.
  const [autoPlay, setAutoPlay] = React.useState(false);
  const touchY = React.useRef<number | null>(null);

  const cur = items[index];
  if (!cur) return null;
  const hasNext = index + 1 < items.length;
  const hasPrev = index > 0;

  const go = (next: number) => {
    if (next < 0 || next >= items.length) return;
    setAutoPlay(true);
    setIndex(next);
    const target = items[next];
    if (target && typeof window !== "undefined") {
      window.history.replaceState(null, "", `/live/${target.id}`);
    }
  };

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
        key={cur.id}
        src={cur.src}
        streamType="on-demand"
        autoPlay={autoPlay}
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
