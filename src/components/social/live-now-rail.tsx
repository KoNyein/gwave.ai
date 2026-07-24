"use client";

import * as React from "react";
import Link from "next/link";
import { Radio } from "lucide-react";

import { attachPreviewHls } from "@/lib/hls-quality";
import type { LiveNowEntry } from "@/lib/db/live";

/**
 * Horizontal "Live now" rail at the top of the feed. Shows every stream that is
 * broadcasting right now — independent of who the viewer follows — so a live
 * broadcast reaches every user, not only the host's followers. Each card plays
 * a muted HLS preview (Safari native, everyone else via hls.js).
 */
export function LiveNowRail({ streams }: { streams: LiveNowEntry[] }) {
  if (streams.length === 0) return null;
  return (
    <section className="rounded-xl border border-black/5 bg-background p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <Radio className="h-4 w-4 animate-pulse text-red-600" />
        <span className="text-sm font-extrabold">🔴 Live now</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {streams.map((s) => (
          <LiveNowCard key={s.id} stream={s} />
        ))}
      </div>
    </section>
  );
}

function LiveNowCard({ stream }: { stream: LiveNowEntry }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const src = stream.ivs_playback_url;

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    const player = attachPreviewHls(v, src);
    return () => player.destroy();
  }, [src]);

  return (
    <Link
      href={`/live/${stream.id}`}
      className="relative w-[132px] shrink-0 overflow-hidden rounded-lg border border-black/5 bg-black"
    >
      <div className="aspect-[9/12] w-full">
        {src ? (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            loop
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1B2417] to-[#0B0F08]">
            <Radio className="h-8 w-8 text-white/70" />
          </div>
        )}
      </div>
      {/* readability gradient */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
        <Radio className="h-2.5 w-2.5 animate-pulse" /> Live
      </span>
      {stream.viewerCount > 0 ? (
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
          👁 {stream.viewerCount}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-2">
        <p className="truncate text-[11px] font-bold text-white">
          {stream.title || "Live"}
        </p>
        <p className="truncate text-[10px] text-white/80">{stream.hostName}</p>
      </div>
    </Link>
  );
}
