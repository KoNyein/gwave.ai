import "server-only";

import Mux from "@mux/mux-node";

/** Mux's global RTMPS ingest endpoint — the host pastes this into OBS etc. */
export const MUX_RTMP_URL = "rtmps://global-live.mux.com:443/app";

let client: Mux | null = null;

/**
 * Lazily construct the Mux client so builds and routes that never touch
 * live streaming work without Mux credentials configured.
 */
export function getMux(): Mux {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error(
      "MUX_TOKEN_ID / MUX_TOKEN_SECRET are not set — live streaming is not configured.",
    );
  }
  client ??= new Mux({
    tokenId,
    tokenSecret,
    webhookSecret: process.env.MUX_WEBHOOK_SECRET,
  });
  return client;
}
