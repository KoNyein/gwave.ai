"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Play, Volume2, VolumeX } from "lucide-react";

import { recordReelView, toggleReelLike } from "@/lib/actions/reels";
import { cn } from "@/lib/utils";
import type { ReelWithAuthor } from "@/types/database";

export function ReelsFeed({ reels }: { reels: ReelWithAuthor[] }) {
  if (!reels.length) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-2xl border bg-muted/40 text-center text-sm text-muted-foreground">
        Reel မရှိသေးပါ — ပထမဆုံး Reel ကို တင်လိုက်ပါ! 🎬
      </div>
    );
  }
  return (
    <div className="h-[80vh] snap-y snap-mandatory overflow-y-auto rounded-2xl bg-black">
      {reels.map((reel) => (
        <ReelItem key={reel.id} reel={reel} />
      ))}
    </div>
  );
}

function ReelItem({ reel }: { reel: ReelWithAuthor }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const viewed = React.useRef(false);

  const [muted, setMuted] = React.useState(true);
  const [playing, setPlaying] = React.useState(false);
  const [liked, setLiked] = React.useState(reel.liked_by_me);
  const [likes, setLikes] = React.useState(reel.like_count);
  const [busy, setBusy] = React.useState(false);

  // Autoplay the reel while it is the one on screen; pause otherwise. Record a
  // single view the first time it becomes visible.
  React.useEffect(() => {
    const el = wrapRef.current;
    const vid = videoRef.current;
    if (!el || !vid) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          vid.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
          if (!viewed.current) {
            viewed.current = true;
            void recordReelView(reel.id);
          }
        } else {
          vid.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reel.id]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      vid.pause();
      setPlaying(false);
    }
  };

  const onLike = async () => {
    if (busy) return;
    setBusy(true);
    // Optimistic.
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    const res = await toggleReelLike(reel.id);
    if (!res.ok) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    } else {
      setLiked(res.data);
    }
    setBusy(false);
  };

  return (
    <div
      ref={wrapRef}
      className="relative flex h-[80vh] snap-start items-center justify-center overflow-hidden"
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.poster_path ? undefined : undefined}
        loop
        muted={muted}
        playsInline
        onClick={togglePlay}
        className="h-full w-full object-contain"
      />

      {/* Play hint when paused */}
      {!playing ? (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play"
        >
          <Play className="h-16 w-16 text-white/80" fill="currentColor" />
        </button>
      ) : null}

      {/* Mute toggle */}
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Right-side actions */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4 text-white">
        <button
          type="button"
          onClick={onLike}
          className="flex flex-col items-center"
          aria-label="Like"
        >
          <Heart
            className={cn(
              "h-8 w-8 drop-shadow",
              liked ? "fill-rose-500 text-rose-500" : "text-white",
            )}
          />
          <span className="text-xs font-medium drop-shadow">{likes}</span>
        </button>
        <div className="flex flex-col items-center">
          <Play className="h-7 w-7 drop-shadow" />
          <span className="text-xs font-medium drop-shadow">{reel.view_count}</span>
        </div>
      </div>

      {/* Author + caption */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pb-6 text-white">
        <Link
          href={reel.author.username ? `/u/${reel.author.username}` : "#"}
          className="font-semibold drop-shadow hover:underline"
        >
          @{reel.author.username ?? reel.author.full_name ?? "user"}
        </Link>
        {reel.caption ? (
          <p className="mt-1 line-clamp-2 text-sm drop-shadow">{reel.caption}</p>
        ) : null}
      </div>
    </div>
  );
}
