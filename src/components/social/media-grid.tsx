"use client";

import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { PostMedia } from "@/types/database";

/** Facebook-style media grid for 1–10 attachments (or a single video). */
export function MediaGrid({ media }: { media: PostMedia[] }) {
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
          <div
            key={item.id}
            className={cn(
              "relative overflow-hidden bg-muted",
              visible.length === 1
                ? "max-h-[600px]"
                : "aspect-square",
              isTallFirst && "row-span-2 aspect-auto",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(item.storage_path)}
              alt=""
              loading="lazy"
              className={cn(
                "h-full w-full object-cover",
                visible.length === 1 && "h-auto max-h-[600px] object-contain",
              )}
            />
            {overflow > 0 && index === visible.length - 1 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">
                +{overflow}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
