"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { PostMedia } from "@/types/database";

/**
 * Facebook-style fullscreen photo viewer: arrow navigation, keyboard support
 * (←/→/Esc), photo counter and download.
 */
function Lightbox({
  media,
  index,
  onIndexChange,
  onClose,
}: {
  media: PostMedia[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const item = media[index];
  const count = media.length;

  const previous = React.useCallback(
    () => onIndexChange((index - 1 + count) % count),
    [count, index, onIndexChange],
  );
  const next = React.useCallback(
    () => onIndexChange((index + 1) % count),
    [count, index, onIndexChange],
  );

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") previous();
      else if (event.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, onClose, previous]);

  if (!item) return null;
  const src = mediaUrl(item.storage_path);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 text-white">
        <span className="text-sm text-white/80">
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-1">
          <a
            href={src}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Download"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] max-w-[96vw] object-contain"
      />

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              previous();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              next();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Facebook-style media grid for 1–10 attachments (or a single video). */
export function MediaGrid({ media }: { media: PostMedia[] }) {
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);

  if (media.length === 0) return null;

  const first = media[0]!;
  if (first.media_type === "video") {
    return (
      <video
        src={mediaUrl(first.storage_path)}
        controls
        playsInline
        className="max-h-[600px] w-full bg-black"
      />
    );
  }

  const visible = media.slice(0, 4);
  const overflow = media.length - visible.length;

  return (
    <>
      <div
        className={cn(
          "grid gap-0.5",
          visible.length === 1 && "grid-cols-1",
          visible.length === 2 && "grid-cols-2",
          visible.length >= 3 && "grid-cols-2",
        )}
      >
        {visible.map((item, index) => {
          const isTallFirst = visible.length === 3 && index === 0;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setViewerIndex(index)}
              className={cn(
                "relative overflow-hidden bg-muted",
                visible.length === 1 ? "max-h-[600px]" : "aspect-square",
                isTallFirst && "row-span-2 aspect-auto",
              )}
              aria-label={`View photo ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(item.storage_path)}
                alt=""
                loading="lazy"
                className={cn(
                  "h-full w-full object-cover",
                  visible.length === 1 &&
                    "h-auto max-h-[600px] object-contain",
                )}
              />
              {overflow > 0 && index === visible.length - 1 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">
                  +{overflow}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {viewerIndex !== null ? (
        <Lightbox
          media={media}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </>
  );
}
