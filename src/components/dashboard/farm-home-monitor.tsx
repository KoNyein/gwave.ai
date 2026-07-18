"use client";

import * as React from "react";
import Link from "next/link";
import { Cctv, Film, Lightbulb, Sprout, Video } from "lucide-react";

import { timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { RecentClip } from "@/lib/db/cctv";
import type { Device } from "@/types/database";

export interface ReadingRow {
  device_id: string;
  metric: string;
  value: number;
  ts: string;
}

/**
 * Dashboard "farm & home" monitor: the user's smart-home devices and CCTV
 * recordings, live. New camera clips appear the moment they're saved
 * (postgres_changes INSERT on camera_clips) and sensor readings update in place
 * — no refresh. Links jump into the full /farm, /home and /cameras sections.
 */
export function FarmHomeMonitor({
  userId,
  devices,
  readings,
  clips,
  cameraNames,
}: {
  userId: string;
  devices: Device[];
  readings: ReadingRow[];
  clips: RecentClip[];
  cameraNames: Record<string, string>;
}) {
  const [liveClips, setLiveClips] = React.useState<RecentClip[]>(clips);
  const [liveReadings, setLiveReadings] = React.useState<ReadingRow[]>(readings);
  const deviceIds = React.useMemo(
    () => new Set(devices.map((d) => d.id)),
    [devices],
  );

  React.useEffect(() => {
    const supabase = createClient();

    // New recordings land instantly on the dashboard.
    const clipsChannel = supabase
      .channel(`dash-clips:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "camera_clips",
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as RecentClip;
          setLiveClips((prev) =>
            prev.some((c) => c.id === row.id)
              ? prev
              : [{ ...row, camera: row.camera ?? null }, ...prev].slice(0, 6),
          );
        },
      )
      .subscribe();

    // Sensor readings update in place (filtered client-side to my devices).
    const readingsChannel = supabase
      .channel(`dash-readings:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_readings" },
        (payload) => {
          const row = payload.new as ReadingRow;
          if (!deviceIds.has(row.device_id)) return;
          setLiveReadings((prev) => {
            const rest = prev.filter(
              (r) => !(r.device_id === row.device_id && r.metric === row.metric),
            );
            return [...rest, { ...row, value: Number(row.value) }];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(clipsChannel);
      void supabase.removeChannel(readingsChannel);
    };
  }, [userId, deviceIds]);

  const onlineCount = devices.filter((d) => d.online).length;
  const readingsByDevice = new Map<string, ReadingRow[]>();
  for (const r of liveReadings) {
    const list = readingsByDevice.get(r.device_id) ?? [];
    list.push(r);
    readingsByDevice.set(r.device_id, list);
  }

  if (devices.length === 0 && liveClips.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Cctv className="h-4 w-4 text-primary" />
          ခြံ / အိမ် / ကင်မရာ — တိုက်ရိုက် အခြေအနေ
        </h2>
        <div className="flex gap-2 text-xs">
          <Link href="/farm" className="flex items-center gap-1 text-primary hover:underline">
            <Sprout className="h-3.5 w-3.5" /> ခြံ
          </Link>
          <Link href="/home" className="flex items-center gap-1 text-primary hover:underline">
            <Lightbulb className="h-3.5 w-3.5" /> အိမ်
          </Link>
          <Link href="/cameras" className="flex items-center gap-1 text-primary hover:underline">
            <Video className="h-3.5 w-3.5" /> ကင်မရာ
          </Link>
        </div>
      </div>

      {devices.length > 0 ? (
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            စက် {devices.length} ခု · online {onlineCount} ခု
          </p>
          <div className="flex flex-wrap gap-2">
            {devices.slice(0, 8).map((device) => {
              const rows = readingsByDevice.get(device.id) ?? [];
              return (
                <div
                  key={device.id}
                  className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs"
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${
                      device.online ? "bg-green-500" : "bg-muted-foreground/40"
                    }`}
                  />
                  <span className="font-medium">{device.name}</span>
                  {rows.slice(0, 2).map((r) => (
                    <span key={r.metric} className="text-muted-foreground">
                      {r.metric} {r.value}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {liveClips.length > 0 ? (
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Film className="h-3.5 w-3.5" /> နောက်ဆုံး ကင်မရာ မှတ်တမ်းများ
            (အသစ်ဝင်လာလျှင် ချက်ချင်း ပေါ်သည်)
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {liveClips.map((clip) => (
              <Link
                key={clip.id}
                href={`/cameras/${clip.camera_id}`}
                className="w-44 shrink-0"
              >
                <video
                  src={mediaUrl(clip.storage_path)}
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full rounded-lg border bg-black object-cover"
                />
                <p className="mt-1 truncate text-xs font-medium">
                  {clip.camera?.title ??
                    cameraNames[clip.camera_id] ??
                    "ကင်မရာ"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {clip.kind === "motion"
                    ? "လှုပ်ရှားမှု"
                    : clip.kind === "face"
                      ? "မျက်နှာ"
                      : "မှတ်တမ်း"}{" "}
                  · {timeAgo(clip.created_at)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
