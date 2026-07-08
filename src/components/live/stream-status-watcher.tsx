"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Refreshes the page when this stream's row changes (idle → live → ended),
 * so viewers see the player appear the moment the broadcast starts.
 */
export function StreamStatusWatcher({ streamId }: { streamId: string }) {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
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
      void supabase.removeChannel(channel);
    };
  }, [streamId, router]);

  return null;
}
