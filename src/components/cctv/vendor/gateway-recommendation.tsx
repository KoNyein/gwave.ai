"use client";

import { Router } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Shown whenever cloud live view is unavailable for a camera — the task
 * document's §23 fallback: never end at a bare error, always point at the
 * RTSP/ONVIF local-gateway path.
 */
export function GatewayRecommendation() {
  const t = useTranslations("cctv");
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
      <Router className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="space-y-1">
        <p className="font-medium">{t("vendorGatewayTitle")}</p>
        <p className="text-muted-foreground">{t("vendorGatewayHint")}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          RTSP/ONVIF → gwave gateway → WebRTC/HLS → gwave.cc
        </p>
      </div>
    </div>
  );
}
