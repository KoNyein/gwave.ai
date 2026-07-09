// Client-safe helpers for building media-server URLs from public env vars.
// These are NEXT_PUBLIC_* so both the browser player and the CSP in
// next.config.mjs can read them. No secrets here — only the public origin of
// the media server that viewers' browsers connect to directly.

/** Public origin of the media server, e.g. https://media.greenwave.example */
export const CCTV_PLAYER_ORIGIN =
  process.env.NEXT_PUBLIC_CCTV_PLAYER_ORIGIN ?? "";

/** Media-server application name (Ant Media default is "LiveApp"). */
export const CCTV_APP = process.env.NEXT_PUBLIC_CCTV_APP ?? "LiveApp";

export function isPlayerConfigured(): boolean {
  return CCTV_PLAYER_ORIGIN !== "";
}

/** URL of the media server's own player page for a stream (embedded in an
 *  iframe). The player page negotiates WebRTC or falls back to HLS itself. */
export function playerUrl(streamId: string): string | null {
  if (!CCTV_PLAYER_ORIGIN) return null;
  return `${CCTV_PLAYER_ORIGIN}/${CCTV_APP}/play.html?id=${encodeURIComponent(streamId)}`;
}

/** URL of the media server's publish page — where the owner's phone/PC starts
 *  broadcasting a WebRTC camera. */
export function publishUrl(streamId: string): string | null {
  if (!CCTV_PLAYER_ORIGIN) return null;
  return `${CCTV_PLAYER_ORIGIN}/${CCTV_APP}/publish.html?id=${encodeURIComponent(streamId)}`;
}
