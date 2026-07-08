"use client";

import * as React from "react";
import { Eye } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/**
 * Live viewer count via a Supabase presence channel. Every open viewer page
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
    const supabase = createClient();
    const channel = supabase.channel(`live-presence:${streamId}`, {
      config: { presence: { key: viewerId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Math.max(1, Object.keys(channel.presenceState()).length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [streamId, viewerId]);

  return (
    <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
      <Eye className="h-3.5 w-3.5" />
      {count}
    </span>
  );
}
