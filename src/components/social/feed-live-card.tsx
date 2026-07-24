"use client";

import * as React from "react";
import Link from "next/link";
import { Radio, PlayCircle } from "lucide-react";

import { attachPreviewHls } from "@/lib/hls-quality";
import { createClient } from "@/lib/data/client";
import { FeedLiveKitPreview } from "./feed-live-livekit";

interface StreamInfo {
  id: string;
  title: string | null;
  status: string;
  host_id: string;
  ivs_playback_url: string | null;
  recording_path: string | null;
  livekit_room: string | null;
  hostName: string;
}

/**
 * Rich card for a live-announcement post in the feed: a real live card with
 * an inline muted video preview when the broadcast has an HLS URL, instead of
 * the generic link-preview box. Flat queries only (no PostgREST embeds).
 */
export function FeedLiveCard({ streamId }: { streamId: string }) {
  const [info, setInfo] = React.useState<StreamInfo | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const cardRef = React.useRef<HTMLAnchorElement>(null);
  // Only join a LiveKit room while the card is actually on screen (cost).
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const db = createClient();
    void (async () => {
      const { data: s } = await db
        .from("live_streams")
        .select(
          "id, title, status, host_id, ivs_playback_url, recording_path, livekit_room",
        )
        .eq("id", streamId)
        .maybeSingle<Omit<StreamInfo, "hostName">>();
      if (!s || cancelled) return;
      const { data: host } = await db
        .from("profiles")
        .select("username, full_name")
        .eq("id", s.host_id)
        .maybeSingle<{ username: string | null; full_name: string | null }>();
      if (cancelled) return;
      setInfo({
        ...s,
        hostName: host?.full_name || host?.username || "Gwave user",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [streamId]);

  // Inline muted autoplay for both lives (HLS) and finished replays — Safari
  // plays m3u8 natively, everything else goes through hls.js.
  const src = React.useMemo(() => {
    if (!info) return null;
    if (info.status === "live") return info.ivs_playback_url;
    if (info.recording_path) {
      return info.recording_path.startsWith("http")
        ? info.recording_path
        : `/recordings/${info.recording_path.replace(/^\/+/, "")}`;
    }
    return null;
  }, [info]);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    const player = attachPreviewHls(v, src);
    return () => player.destroy();
  }, [src]);

  // Watch whether the card is on screen so a LiveKit preview connects only then.
  React.useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { rootMargin: "100px", threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!info) return null;
  const live = info.status === "live";
  const replayable = !live && Boolean(info.recording_path);
  const showVideo = Boolean(src);
  // Browser "Go Live" (LiveKit) stream: no HLS URL, so play it inline via WebRTC.
  const livekitLive = live && !src && Boolean(info.livekit_room);

  return (
    <Link
      ref={cardRef}
      href={`/live/${info.id}`}
      className="mt-2 block overflow-hidden rounded-xl border border-black/5 bg-gradient-to-br from-[#1B2417] to-[#0B0F08]"
    >
      {showVideo ? (
        <div className="relative aspect-video w-full bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            loop
            className="h-full w-full object-cover"
          />
          <span
            className={`absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white ${
              live ? "bg-red-600" : "bg-black/60"
            }`}
          >
            {live ? (
              <>
                <Radio className="h-3 w-3 animate-pulse" /> LIVE
              </>
            ) : (
              <>
                <PlayCircle className="h-3 w-3" /> REPLAY
              </>
            )}
          </span>
        </div>
      ) : livekitLive ? (
        <div className="relative aspect-video w-full bg-black">
          <FeedLiveKitPreview streamId={info.id} active={inView} />
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
            <Radio className="h-3 w-3 animate-pulse" /> LIVE
          </span>
        </div>
      ) : null}
      <div className="flex items-center gap-3 p-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            live ? "bg-red-600" : "bg-white/15"
          }`}
        >
          {live ? (
            <Radio className="h-5 w-5 text-white" />
          ) : (
            <PlayCircle className="h-5 w-5 text-white" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-white">
            {info.title || "Live broadcast"}
          </span>
          <span
            className={`block text-xs font-bold ${
              live ? "text-red-300" : "text-white/70"
            }`}
          >
            {live
              ? `🔴 ${info.hostName} — တိုက်ရိုက်လွှင့်နေသည်၊ နှိပ်ပြီးကြည့်ပါ`
              : replayable
                ? `▶ ${info.hostName} — Replay ပြန်ကြည့်ရန်`
                : `${info.hostName} — Live ပြီးသွားပါပြီ`}
          </span>
        </span>
      </div>
    </Link>
  );
}
