"use client";

import * as React from "react";
import { Eye } from "lucide-react";

import { createClient } from "@/lib/data/client";

/**
 * Live viewer count via a Realtime presence channel (our self-hosted Realtime,
 * reached through the data client). Every open viewer page
 * tracks itself; the count is the number of tracked presences.
 */
export function ViewerCount({
  streamId,
  viewerId,
}: {
  streamId: string;
  viewerId: string;
}) {
  const [count, setCount] = React.useState(1);

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
        () => undefined,
        () => undefined,
      );
    };

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Math.max(1, Object.keys(channel.presenceState()).length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
          heartbeat();
        }
      });

    // The RPC counts viewers seen in the last ~25s, so beat well inside that window.
    const timer = setInterval(heartbeat, 15000);

    return () => {
      clearInterval(timer);
      void db.removeChannel(channel);
    };
  }, [streamId, viewerId]);

  return (
    <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
      <Eye className="h-3.5 w-3.5" />
      {count}
    </span>
  );
}
