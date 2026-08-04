"use client";

import { useTranslations } from "next-intl";

import type { CameraVendorCapabilities } from "@/types/database";

/**
 * Badge row for a vendor camera's normalized capabilities. Only shows what
 * the camera HAS — an empty row means metadata/events only.
 */
export function VendorCapabilities({
  capabilities,
}: {
  capabilities: CameraVendorCapabilities;
}) {
  const t = useTranslations("cctv");
  const items: Array<[keyof CameraVendorCapabilities, string]> = [
    ["liveView", t("vendorCapLive")],
    ["snapshot", t("vendorCapSnapshot")],
    ["ptz", t("vendorCapPtz")],
    ["audio", t("vendorCapAudio")],
    ["events", t("vendorCapEvents")],
    ["playback", t("vendorCapPlayback")],
  ];
  const active = items.filter(([key]) => capabilities[key]);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map(([key, label]) => (
        <span
          key={key}
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
