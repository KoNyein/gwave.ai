"use client";

import * as React from "react";
import Link from "next/link";
import { PlayCircle, Radio } from "lucide-react";
import Hls from "hls.js";

export interface LiveCardData {
  id: string;
  title: string;
  hostName: string;
  hostAvatar: string | null;
  src: string | null; // HLS (live) or /recordings replay URL
  live: boolean;
  viewerCount: number;
  startedAgo: string | null;
}

/** Attach an HLS source to a <video>: Safari plays m3u8 natively, everyone
 *  else via hls.js. Returns a cleanup fn. */
function attachHls(v: HTMLVideoElement, src: string): () => void {
  if (v.canPlayType("application/vnd.apple.mpegurl")) {
    v.src = src;
    void v.play().catch(() => undefined);
    return () => {
      v.removeAttribute("src");
      v.load();
    };
  }
  if (Hls.isSupported()) {
    const hls = new Hls({ capLevelToPlayerSize: true });
    hls.loadSource(src);
    hls.attachMedia(v);
    void v.play().catch(() => undefined);
    return () => hls.destroy();
  }
  return () => undefined;
}

function LiveCard({ card }: { card: LiveCardData }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v || !card.src) return;
    return attachHls(v, card.src);
  }, [card.src]);

  return (
    <Link
      href={`/live/${card.id}`}
      className="group relative block overflow-hidden rounded-xl border border-black/5 bg-black shadow-sm"
    >
      <div className="relative aspect-video w-full">
        {card.src ? (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1B2417] to-[#0B0F08]">
            <Radio className="h-10 w-10 text-white/60" />
          </div>
        )}
        {/* readability gradient */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />

        {/* badge */}
        <span
          className={`absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white ${
            card.live ? "bg-red-600" : "bg-black/60"
          }`}
        >
          {card.live ? (
            <>
              <Radio className="h-3 w-3 animate-pulse" /> Live
            </>
          ) : (
            <>
              <PlayCircle className="h-3 w-3" /> Replay
            </>
          )}
        </span>
        {card.viewerCount > 0 ? (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
            👁 {card.viewerCount}
          </span>
        ) : null}
        {!card.live && !card.src ? null : !card.live ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="h-14 w-14 text-white/85 drop-shadow-lg transition-transform group-hover:scale-110" />
          </span>
        ) : null}

        {/* host + title */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xs font-bold text-white ring-2 ring-white/30">
            {card.hostAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.hostAvatar}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              card.hostName.slice(0, 2).toUpperCase()
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-white">
              {card.title}
            </span>
            <span className="block truncate text-xs text-white/80">
              {card.hostName}
              {card.startedAgo ? ` · ${card.startedAgo}` : ""}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** The Facebook/TikTok-style live + replay grid used on the /live page. */
export function LiveCards({ cards }: { cards: LiveCardData[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <LiveCard key={c.id} card={c} />
      ))}
    </div>
  );
}
