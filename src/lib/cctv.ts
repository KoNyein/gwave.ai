import "server-only";

// Integration with an external media server (Ant Media Server or LiveKit,
// running on the operator's own AWS/infra) that carries the actual CCTV video.
// GreenWave never proxies the video itself — it only asks the media server to
// register or tear down a stream over its REST API, and hands the browser a
// player URL that talks to the media server directly (WebRTC/HLS).
//
// Everything here degrades gracefully: if the media server is not configured,
// cameras can still be created and managed (the rows and share links work);
// they simply will not carry live video until an operator points the app at a
// running media server via the environment variables below.

/** REST base of the media server, including the application path.
 *  e.g. http://10.0.0.5:5080/LiveApp/rest  (Ant Media Server v2 REST) */
const API_URL = process.env.CCTV_MEDIA_API_URL;
/** Optional bearer token / JWT for the media server's REST API. */
const API_TOKEN = process.env.CCTV_MEDIA_API_TOKEN;

export function isMediaServerConfigured(): boolean {
  return Boolean(API_URL);
}

type BroadcastType = "liveStream" | "streamSource";

interface RegisterResult {
  /** Whether the media server was actually contacted. */
  configured: boolean;
  /** True when the media server accepted the stream (or is not configured). */
  ok: boolean;
  error?: string;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;
  return headers;
}

/**
 * Register a stream on the media server.
 *  - webrtc cameras publish from a phone/PC, so we create an empty liveStream
 *    the browser then publishes into.
 *  - rtsp cameras are pulled by the media server itself from `rtspUrl`
 *    (a streamSource), so no browser publisher is needed.
 */
export async function registerBroadcast(params: {
  streamId: string;
  name: string;
  type: BroadcastType;
  rtspUrl?: string | null;
}): Promise<RegisterResult> {
  if (!API_URL) return { configured: false, ok: true };

  const body: Record<string, unknown> = {
    streamId: params.streamId,
    name: params.name,
    type: params.type,
  };
  if (params.type === "streamSource" && params.rtspUrl) {
    body.streamUrl = params.rtspUrl;
  }

  try {
    const res = await fetch(`${API_URL}/v2/broadcasts/create`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      // The media server is trusted infra, but never hang a request forever.
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        error: `Media server responded ${res.status}`,
      };
    }
    return { configured: true, ok: true };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "Media server unreachable",
    };
  }
}

/** Remove a stream from the media server. Best-effort; failures are ignored so
 *  a camera can always be deleted from GreenWave even if the media server is
 *  down or already forgot the stream. */
export async function removeBroadcast(streamId: string): Promise<void> {
  if (!API_URL) return;
  try {
    await fetch(`${API_URL}/v2/broadcasts/${encodeURIComponent(streamId)}`, {
      method: "DELETE",
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    // Best-effort cleanup — swallow errors.
  }
}
