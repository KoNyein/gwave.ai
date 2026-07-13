"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Navigation, Square } from "lucide-react";

import { LocationMap } from "@/components/social/location-map";
import { stopLiveLocation } from "@/lib/actions/live-location";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { LiveLocation } from "@/types/database";

function minutesLeft(expiresAt: string): number {
  return Math.max(
    0,
    Math.round((new Date(expiresAt).getTime() - Date.now()) / 60_000),
  );
}

/**
 * A live-location bubble: the pin moves as the sender moves. The message row
 * carries the starting point so this renders instantly; the moving position
 * comes from live_locations, which we read once and then follow over Realtime.
 */
export function LiveLocationMessage({
  messageId,
  startLatitude,
  startLongitude,
  liveUntil,
  mine,
  onStopped,
}: {
  messageId: string;
  startLatitude: number;
  startLongitude: number;
  liveUntil: string;
  mine: boolean;
  /**
   * Stopping from the bubble has to stop the GPS watch too. Without this it only
   * wrote stopped_at: the watch kept running for the full duration, the banner
   * kept counting down, and a reload resumed the whole thing.
   */
  onStopped?: (messageId: string) => void;
}) {
  const t = useTranslations("messenger");
  const supabase = React.useMemo(() => createClient(), []);
  const [row, setRow] = React.useState<LiveLocation | null>(null);
  const [stopping, setStopping] = React.useState(false);
  // Re-render on a timer so "ends in 12 min" counts down and the bubble flips
  // itself to "ended" the moment it expires, with no event to prompt it.
  const [, tick] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    void supabase
      .from("live_locations")
      .select("*")
      .eq("message_id", messageId)
      .maybeSingle<LiveLocation>()
      .then(({ data }) => {
        if (active && data) setRow(data);
      });

    const channel = supabase
      .channel(`live-location:${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_locations",
          filter: `message_id=eq.${messageId}`,
        },
        (payload) => setRow(payload.new as LiveLocation),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [messageId, supabase]);

  React.useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresAt = row?.expires_at ?? liveUntil;
  const ended =
    Boolean(row?.stopped_at) || new Date(expiresAt).getTime() <= Date.now();
  const latitude = row?.latitude ?? startLatitude;
  const longitude = row?.longitude ?? startLongitude;

  async function stop() {
    setStopping(true);
    await stopLiveLocation(messageId);
    setRow((previous) =>
      previous
        ? { ...previous, stopped_at: new Date().toISOString() }
        : previous,
    );
    onStopped?.(messageId);
    setStopping(false);
  }

  return (
    <div className="w-64 sm:w-72">
      <div className="relative">
        <LocationMap
          latitude={latitude}
          longitude={longitude}
          className="h-40 w-full overflow-hidden"
        />
        {!ended ? (
          <span className="absolute left-2 top-2 z-[400] flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground shadow">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {t("live")}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <Navigation
          className={cn(
            "h-4 w-4 shrink-0",
            ended ? "opacity-50" : "text-destructive",
          )}
        />
        <p className="min-w-0 flex-1 text-xs">
          {ended
            ? t("liveLocationEnded")
            : t("liveLocationActive", { minutes: minutesLeft(expiresAt) })}
        </p>
        {mine && !ended ? (
          <button
            type="button"
            onClick={() => void stop()}
            disabled={stopping}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
              "bg-primary-foreground/15 hover:bg-primary-foreground/25 disabled:opacity-50",
            )}
          >
            <Square className="h-3 w-3 fill-current" />
            {t("stopSharing")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
