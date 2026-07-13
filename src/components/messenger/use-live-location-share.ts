"use client";

import * as React from "react";

import {
  moveLiveLocation,
  stopLiveLocation,
} from "@/lib/actions/live-location";
import { watchPosition } from "@/lib/geolocation";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";

export interface LiveShare {
  messageId: string;
  conversationId: string;
  expiresAt: string;
}

/** Don't write to the DB more often than this, however chatty the GPS is. */
const MIN_INTERVAL_MS = 10_000;
/** …but do write at least this often, so recipients can see it's still alive. */
const HEARTBEAT_MS = 45_000;
/** Ignore jitter: below this, the pin hasn't really moved. */
const MIN_MOVE_METRES = 15;

function metresBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * The sender half of live location: while a share is running, watch the GPS and
 * push the pin. Persisted, so reloading the page (or coming back to the tab)
 * resumes the share instead of silently stranding the people watching it.
 *
 * The browser only runs this while the app is open — there is no background
 * geolocation on the web — so a share goes quiet if the tab is closed and
 * lapses on its own at expires_at. Recipients see the last known position and
 * how long ago it was updated, which is the honest thing to show.
 */
export function useLiveLocationShare(
  onError?: (message: string) => void,
  /**
   * Set false where another mount of this hook is already driving the share.
   * Two watchers would both push the pin; none at all (which is what happened
   * when the messenger unmounted on navigation) leaves the recipients staring at
   * a LIVE badge on a pin that has quietly stopped moving.
   */
  enabled = true,
) {
  const [share, setShare] = usePersistentState<LiveShare | null>(
    "gw:live-location-share",
    null,
  );

  const lastSentAt = React.useRef(0);
  const lastFix = React.useRef<{ latitude: number; longitude: number } | null>(
    null,
  );
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  const expired = share
    ? new Date(share.expiresAt).getTime() <= Date.now()
    : false;

  React.useEffect(() => {
    if (!share || expired) {
      if (share && expired) setShare(null);
      return;
    }
    if (!enabled) return;

    // A fresh share must not inherit the previous one's throttle state, or its
    // first fix is suppressed for up to 45 seconds.
    lastSentAt.current = 0;
    lastFix.current = null;

    const stopWatching = watchPosition(
      (fix) => {
        const now = Date.now();
        const moved = lastFix.current
          ? metresBetween(lastFix.current, fix)
          : Infinity;
        const due =
          now - lastSentAt.current >= HEARTBEAT_MS ||
          (now - lastSentAt.current >= MIN_INTERVAL_MS &&
            moved >= MIN_MOVE_METRES);
        if (!due) return;

        lastSentAt.current = now;
        lastFix.current = { latitude: fix.latitude, longitude: fix.longitude };
        void moveLiveLocation({
          messageId: share.messageId,
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
        });
      },
      (message) => onErrorRef.current?.(message),
    );

    // Retire the share the moment it lapses, without waiting for a GPS fix.
    const timer = window.setTimeout(
      () => setShare(null),
      Math.max(0, new Date(share.expiresAt).getTime() - Date.now()),
    );

    return () => {
      stopWatching();
      window.clearTimeout(timer);
    };
  }, [share, expired, setShare, enabled]);

  const stop = React.useCallback(async () => {
    if (!share) return;
    await stopLiveLocation(share.messageId);
    setShare(null);
  }, [share, setShare]);

  return {
    share: expired ? null : share,
    start: setShare,
    stop,
  };
}
