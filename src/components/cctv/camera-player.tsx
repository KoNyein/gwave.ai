"use client";

import { VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { playerUrl } from "@/lib/cctv-player";

/**
 * Embeds the media server's own player page for a stream. The media server
 * (Ant Media / LiveKit) handles WebRTC negotiation or HLS fallback inside the
 * iframe. If no media server is configured, shows a clear placeholder rather
 * than a broken frame.
 */
export function CameraPlayer({
  streamId,
  title,
}: {
  streamId: string;
  title: string;
}) {
  const t = useTranslations("cctv");
  const url = playerUrl(streamId);

  if (!url) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 text-center">
        <VideoOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">{t("playerNotConfigured")}</p>
        <p className="max-w-sm px-4 text-xs text-muted-foreground">
          {t("playerNotConfiguredHint")}
        </p>
      </div>
    );
  }

  return (
    <iframe
      title={title}
      src={url}
      // The media server page needs scripts for WebRTC; it is a first-party,
      // operator-controlled origin allow-listed in the CSP frame-src.
      sandbox="allow-scripts allow-same-origin"
      allow="autoplay; fullscreen"
      className="aspect-video w-full rounded-xl border bg-black"
    />
  );
}
