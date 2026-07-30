"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ImageOff, Play, X, ZoomIn } from "lucide-react";

/**
 * The product gallery a reseller can actually sell from.
 *
 * The old version showed the cover and turned the rest into links that opened
 * raw image URLs in a new tab — which is what you build when a server
 * component can't hold state, and which is useless to someone deciding whether
 * to buy. This is the client half: one big image, a thumbnail rail, arrows and
 * swipe, a counter, and a full-screen viewer with the same controls.
 *
 * `video` comes first when the merchant published one, because a 15-second
 * clip closes a sale that six stills do not.
 */
export function ProductGallery({
  images,
  title,
  video,
}: {
  images: string[];
  title: string;
  video?: string | null;
}) {
  const [index, setIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(false);
  const [showVideo, setShowVideo] = React.useState(false);
  const touchX = React.useRef<number | null>(null);

  const count = images.length;
  const go = React.useCallback(
    (delta: number) => {
      if (count === 0) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  // Arrow keys drive the viewer; Escape closes it. Only while it is open, so
  // the page's own scrolling keeps working the rest of the time.
  React.useEffect(() => {
    if (!zoom) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, go]);

  if (count === 0 && !video) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border bg-muted text-muted-foreground">
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
        {showVideo && video ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={video}
            controls
            autoPlay
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        ) : count > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[index]}
              alt={`${title} — ${index + 1}/${count}`}
              referrerPolicy="no-referrer"
              className="h-full w-full cursor-zoom-in object-cover"
              onClick={() => setZoom(true)}
              onTouchStart={(e) => {
                touchX.current = e.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                const start = touchX.current;
                const end = e.changedTouches[0]?.clientX;
                touchX.current = null;
                if (start == null || end == null) return;
                // 40px so a tap that drifts a little still counts as a tap.
                if (Math.abs(end - start) > 40) go(end < start ? 1 : -1);
              }}
            />
            {count > 1 ? (
              <>
                <GalleryArrow side="left" onClick={() => go(-1)} />
                <GalleryArrow side="right" onClick={() => go(1)} />
                <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                  {index + 1} / {count}
                </span>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setZoom(true)}
              aria-label="Zoom"
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </>
        ) : null}

        {video && !showVideo ? (
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/80"
          >
            <Play className="h-3.5 w-3.5" /> Video
          </button>
        ) : null}
      </div>

      {count > 1 || video ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {video ? (
            <button
              type="button"
              onClick={() => setShowVideo(true)}
              className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-black text-white ${
                showVideo ? "ring-2 ring-primary" : ""
              }`}
            >
              <Play className="h-5 w-5" />
            </button>
          ) : null}
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setShowVideo(false);
                setIndex(i);
              }}
              className={`shrink-0 overflow-hidden rounded-lg border bg-muted ${
                !showVideo && i === index ? "ring-2 ring-primary" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${title} — ${i + 1}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-16 w-16 object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {zoom && count > 0 ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setZoom(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index]}
            alt={`${title} — ${index + 1}/${count}`}
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {count > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-3 rounded-full bg-white/15 p-2 text-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-3 rounded-full bg-white/15 p-2 text-white"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <span className="absolute bottom-4 rounded-full bg-white/15 px-3 py-1 text-sm text-white">
                {index + 1} / {count}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GalleryArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white transition-colors hover:bg-black/70 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {side === "left" ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}
