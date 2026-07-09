"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";

type PlayerState = "loading" | "playing" | "error";

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
      void video.play().catch(() => {
        /* autoplay may be blocked; the poster/controls remain usable */
      });
    } else {
      // Everyone else: hls.js, loaded on demand.
      import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (!Hls.isSupported()) {
            setState("error");
            return;
          }
          hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            // Only a fatal error means playback truly failed.
            if (data.fatal) setState("error");
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            void video.play().catch(() => {
              /* autoplay may be blocked */
            });
          });
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
  }, [src]);

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
      {state !== "playing" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-white">
          {state === "loading" ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin" />
              <p className="text-sm">{t("hlsLoading")}</p>
            </>
          ) : (
            <>
              <VideoOff className="h-7 w-7" />
              <p className="text-sm font-medium">{t("hlsError")}</p>
              <p className="max-w-xs px-4 text-xs text-white/70">
                {t("hlsErrorHint")}
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
