import "server-only";

import { mintServiceToken } from "@/lib/auth/tokens";
import { publicEnv } from "@/lib/env";

/**
 * Server-side Realtime broadcast over the HTTP API (`POST /api/broadcast` on
 * the self-hosted supabase/realtime server, reached through the same
 * `/realtime/v1` proxy path the websocket clients use). Reaches every current
 * subscriber of a public channel without the server holding a websocket.
 *
 * Used to relay call rings: the caller's own client-side broadcast only works
 * while its realtime socket is healthy and its channel join was accepted —
 * this relay makes the ring arrive even when that leg fails. Best-effort:
 * logs and returns false on failure, never throws.
 */
export async function serverBroadcast(
  topic: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const base = publicEnv.NEXT_PUBLIC_DATA_API_URL;
  if (!base) return false;
  const url =
    process.env.REALTIME_BROADCAST_URL ??
    `${base.replace(/\/$/, "")}/realtime/v1/api/broadcast`;
  try {
    const token = await mintServiceToken();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: publicEnv.NEXT_PUBLIC_DATA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload, private: false }],
      }),
    });
    if (!res.ok) {
      console.warn(
        `[realtime] server broadcast ${topic}/${event} -> ${res.status}`,
        (await res.text()).slice(0, 300),
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[realtime] server broadcast ${topic}/${event} failed`, error);
    return false;
  }
}
