import "server-only";

import { AccessToken } from "livekit-server-sdk";

/**
 * LiveKit (SFU) configuration. When these are set, co-host Live routes its
 * media through the LiveKit media server instead of the peer-to-peer mesh, so a
 * few publishers can broadcast to thousands of viewers. When unset, co-host
 * Live falls back to the mesh room (good for a handful of co-hosts, no server).
 *
 * - LIVEKIT_API_KEY / LIVEKIT_API_SECRET  server-only, used to mint access tokens
 * - NEXT_PUBLIC_LIVEKIT_URL               wss:// URL the browser connects to
 */
export function livekitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET &&
      process.env.NEXT_PUBLIC_LIVEKIT_URL,
  );
}

export function livekitUrl(): string | null {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL ?? null;
}

/**
 * Mint a signed LiveKit access token for one participant. Publish permission is
 * decided by the caller (host + approved co-hosts publish; everyone else only
 * subscribes) and encoded in the token so a viewer can never publish by
 * tampering with the client.
 */
export async function mintLivekitToken(opts: {
  room: string;
  identity: string;
  name: string;
  canPublish: boolean;
}): Promise<string> {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) {
    throw new Error("LiveKit is not configured (LIVEKIT_API_KEY/SECRET).");
  }

  const at = new AccessToken(key, secret, {
    identity: opts.identity,
    name: opts.name,
    ttl: "2h",
  });
  at.addGrant({
    roomJoin: true,
    room: opts.room,
    canPublish: opts.canPublish,
    canSubscribe: true,
    // Publishers may also share data (reactions, screen share); viewers can
    // send data too (e.g. raise-hand) but not media.
    canPublishData: true,
  });
  return at.toJwt();
}
