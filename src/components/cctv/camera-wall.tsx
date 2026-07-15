"use client";

import * as React from "react";
import Link from "next/link";
import { Grid2x2, Grid3x3, Maximize2, Video } from "lucide-react";
import { useTranslations } from "next-intl";

import { HlsPlayer } from "@/components/cctv/hls-player";
import { KvsPlayer } from "@/components/cctv/kvs-player";
import { cn } from "@/lib/utils";

export interface WallCamera {
  id: string;
  title: string;
  camera_type: "webrtc" | "rtsp" | "kvs";
  hls_url: string | null;
}

/**
 * A live CCTV wall — every camera playing at once in a responsive grid, like a
 * security monitor. KVS + HLS cameras render live video; media-server cameras
 * (iframe players) show a tile that opens the full view. A column toggle packs
 * more or fewer feeds per row.
 */
export function CameraWall({ cameras }: { cameras: WallCamera[] }) {
  const t = useTranslations("cctv");
  const [cols, setCols] = React.useState<2 | 3>(2);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        <span className="mr-1 text-xs text-muted-foreground">{t("wallCols")}</span>
        <button
          type="button"
          onClick={() => setCols(2)}
          aria-label="2 columns"
          className={cn(
            "rounded-lg border p-1.5",
            cols === 2 ? "border-primary text-primary" : "text-muted-foreground",
          )}
        >
          <Grid2x2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCols(3)}
          aria-label="3 columns"
          className={cn(
            "rounded-lg border p-1.5",
            cols === 3 ? "border-primary text-primary" : "text-muted-foreground",
          )}
        >
          <Grid3x3 className="h-4 w-4" />
        </button>
      </div>

      <div
        className={cn(
          "grid gap-3",
          cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {cameras.map((cam) => (
          <div key={cam.id} className="space-y-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="truncate text-sm font-medium">{cam.title}</span>
              <Link
                href={`/cameras/${cam.id}`}
                aria-label={t("openCamera")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
            </div>
            {cam.camera_type === "kvs" ? (
              <KvsPlayer id={cam.id} title={cam.title} compact />
            ) : cam.hls_url ? (
              <HlsPlayer src={cam.hls_url} title={cam.title} />
            ) : (
              <Link
                href={`/cameras/${cam.id}`}
                className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-xl border bg-muted/40 text-center text-muted-foreground transition-colors hover:bg-muted"
              >
                <Video className="h-7 w-7" />
                <span className="text-xs">{t("openCamera")}</span>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
