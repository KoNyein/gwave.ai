"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";

type PlayerState = "loading" | "paused" | "playing" | "error";

/**
 * Plays a live HLS (.m3u8) stream directly in a <video> element.
 *
 * The stream URL is a credential-free playback URL served by the operator's
 * media server (MediaMTX / Ant Media / nginx). The private RTSP source — which
 * may carry a camera password — never reaches this component; it stays on the
 * server. So there is nothing sensitive to leak here.
 *
 * Safari (and iOS) can play HLS natively via the <video> src, so we use that
 * path when available and only pull in hls.js (lazy-loaded, so it never bloats
 * pages that don't need it) for browsers that can't — Chrome, Firefox, Edge.
 */
export function HlsPlayer({ src, title }: { src: string; title: string }) {
  const t = useTranslations("cctv");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>("loading");

  // Try to autoplay; if the browser blocks it (common when not muted, or under
  // strict autoplay settings), fall back to a "paused" state that shows a play
  // button the user can click, rather than a spinner that never resolves.
  const tryPlay = useCallback((video: HTMLVideoElement) => {
    video.play().catch(() => {
      // A rejected play() means autoplay was blocked, not a stream error.
      setState((s) => (s === "playing" ? s : "paused"));
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setState("loading");
    let destroyed = false;
    // Holds the hls.js instance so cleanup can tear it down.
    let hls: import("hls.js").default | null = null;

    const onPlaying = () => {
      if (!destroyed) setState("playing");
    };
    video.addEventListener("playing", onPlaying);

    // Safari / iOS: native HLS. No extra library needed.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("error", () => {
        if (!destroyed) setState("error");
      });
      tryPlay(video);
    } else {
      // Everyone else: hls.js, loaded on demand.
      import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (!Hls.isSupported()) {
            setState("error");
            return;
          }
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            capLevelToPlayerSize: false, // reach the sharpest rendition
            maxBufferLength: 30,
            backBufferLength: 30,
          });
          let mediaRecoveries = 0;
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (!data.fatal) return;
            // Self-heal transient drops before surfacing a hard error, so a
            // brief network blip doesn't freeze the feed on the last frame.
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls?.startLoad();
            } else if (
              data.type === Hls.ErrorTypes.MEDIA_ERROR &&
              mediaRecoveries < 2
            ) {
              mediaRecoveries += 1;
              hls?.recoverMediaError();
            } else {
              setState("error");
            }
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => tryPlay(video));
        })
        .catch(() => {
          if (!destroyed) setState("error");
        });
    }

    return () => {
      destroyed = true;
      video.removeEventListener("playing", onPlaying);
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, tryPlay]);

  const onPlayClick = () => {
    const video = videoRef.current;
    if (video) void video.play().catch(() => setState("error"));
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
      <video
        ref={videoRef}
        title={title}
        controls
        muted
        playsInline
        className="h-full w-full"
      />
      {state === "loading" ? (
        // pointer-events-none so the native controls underneath stay reachable
        // even while the connecting overlay is shown.
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-white">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm">{t("hlsLoading")}</p>
        </div>
      ) : state === "paused" ? (
        <button
          type="button"
          onClick={onPlayClick}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center text-white transition-colors hover:bg-black/50"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black">
            <Play className="h-7 w-7 translate-x-0.5" />
          </span>
          <span className="text-sm font-medium">{t("hlsPlay")}</span>
        </button>
      ) : state === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-white">
          <VideoOff className="h-7 w-7" />
          <p className="text-sm font-medium">{t("hlsError")}</p>
          <p className="max-w-xs px-4 text-xs text-white/70">
            {t("hlsErrorHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
