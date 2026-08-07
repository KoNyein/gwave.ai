"use client";

import * as React from "react";
import { Eye } from "lucide-react";

import { createClient } from "@/lib/data/client";
import { useVisibleInterval } from "@/lib/use-visible-interval";

/**
 * Live viewer count — from both places viewers actually come from.
 *
 * Presence covers browsers: every open viewer page tracks itself on a Realtime
 * channel. It cannot see the Flutter app, which has no such channel, so a host
 * broadcasting from a browser watched their own page say "1 viewer" while two
 * phones were watching and one of them was sending hearts.
 *
 * The database already knew. `live_heartbeat()` is called by both clients and
 * *returns* the real count — presence rows touched in the last 25 seconds,
 * whatever the viewer was using. That return value was being thrown away.
 *
 * So: show the larger of the two. Presence updates the instant somebody opens
 * or closes a tab; the heartbeat count arrives every 15 seconds and is the only
 * one that knows about phones. Neither alone is the answer.
 */
export function ViewerCount({
  streamId,
  viewerId,
}: {
  streamId: string;
  viewerId: string;
}) {
  const [presenceCount, setPresenceCount] = React.useState(1);
  const [heartbeatCount, setHeartbeatCount] = React.useState(0);
  const beatRef = React.useRef<(() => void) | null>(null);

  // 🔋 The RPC counts viewers seen in the last ~25s, so beat well inside that
  // window — but only while the tab is actually visible. A backgrounded tab is
  // not a viewer, and beating from it kept phones awake and inflated the count.
  useVisibleInterval(() => beatRef.current?.(), 15000);

  React.useEffect(() => {
    const db = createClient();
    const channel = db.channel(`live-presence:${streamId}`, {
      config: { presence: { key: viewerId } },
    });

    // Presence gives the live count to viewers; the heartbeat persists it so the
    // host dashboard's "Peak viewers" is non-zero. live_heartbeat() records this
    // viewer (viewer_id = auth.uid(), un-spoofable) and lifts live_streams.viewer_count
    // to the running peak. Best-effort — a failed heartbeat must never break playback.
    const heartbeat = () => {
      void db.rpc("live_heartbeat", { p_stream: streamId }).then(
        ({ data }) => {
          if (typeof data === "number" && data > 0) setHeartbeatCount(data);
        },
        () => undefined,
      );
    };
    beatRef.current = heartbeat;

    channel
      .on("presence", { event: "sync" }, () => {
        setPresenceCount(
          Math.max(1, Object.keys(channel.presenceState()).length),
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
          heartbeat();
        }
      });

    return () => {
      beatRef.current = null;
      void db.removeChannel(channel);
    };
  }, [streamId, viewerId]);

  return (
    <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
      <Eye className="h-3.5 w-3.5" />
      {Math.max(presenceCount, heartbeatCount, 1)}
    </span>
  );
}
