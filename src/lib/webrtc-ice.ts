"use client";

// Runtime ICE (STUN/TURN) config from /api/webrtc/ice, shared by every WebRTC
// feature (messenger calls, live meet rooms). The TURN relay is what lets two
// peers behind carrier NAT actually exchange media — STUN alone connects the
// call signaling but leaves both sides silent.

export const FALLBACK_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

let cached: RTCIceServer[] | null = null;
let inflight: Promise<RTCIceServer[]> | null = null;

export function fetchIceServers(): Promise<RTCIceServer[]> {
  if (cached) return Promise.resolve(cached);
  inflight ??= (async () => {
    try {
      const res = await fetch("/api/webrtc/ice");
      if (res.ok) {
        const body = (await res.json()) as { iceServers?: RTCIceServer[] };
        if (Array.isArray(body.iceServers) && body.iceServers.length) {
          cached = body.iceServers;
          return cached;
        }
      }
    } catch {
      // fall through to the STUN-only fallback
    }
    inflight = null; // allow a retry on the next call
    return FALLBACK_ICE;
  })();
  return inflight;
}

/** Cached servers if the fetch already landed, STUN fallback otherwise. */
export function iceServersSync(): RTCIceServer[] {
  return cached ?? FALLBACK_ICE;
}
