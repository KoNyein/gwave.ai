"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/data/client";

/**
 * Refreshes the page when this stream's row changes (idle → live → ended),
 * so viewers see the player appear the moment the broadcast starts.
 */
export function StreamStatusWatcher({ streamId }: { streamId: string }) {
  const router = useRouter();

  React.useEffect(() => {
    const db = createClient();
    const channel = db
      .channel(`live-status:${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_streams",
          filter: `id=eq.${streamId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [streamId, router]);

  return null;
}
