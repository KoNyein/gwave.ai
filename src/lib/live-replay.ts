import "server-only";

import { agoraRecordingUrl } from "@/lib/agora";
import { ivsRecordingUrl } from "@/lib/ivs-realtime";
import { recordingPlaybackUrl } from "@/lib/livekit";
import { mediaUrl } from "@/lib/media-url";

/**
 * Turns a finished broadcast's stored `recording_path` into a playable URL —
 * the VOD (replay) resolver for the native app.
 *
 * The app calls /api/mobile/live/replays and is handed a finished URL; it never
 * builds one itself. A second copy of this fallback chain in Dart is how the
 * reels player ended up pointing at a dead backend after the S3 cutover.
 *
 * This mirrors `resolveReplayUrl()` in src/app/(social)/live/[id]/page.tsx —
 * keep the two in step until one of them is collapsed into the other.
 */
export interface ReplaySource {
  status: string;
  recording_path: string | null;
  livekit_room?: string | null;
  agora_channel?: string | null;
  /** IVS Real-Time (stage composite) — browser broadcasts. */
  ivs_stage_arn?: string | null;
  /** IVS Low-Latency (channel recording) — the shipping mobile app's path. */
  ivs_channel_arn?: string | null;
}

/**
 * Playable URL for a stream's saved replay, or null when it has none (still
 * live, or the recording never landed). May be an .m3u8 (IVS writes HLS) or an
 * .mp4 (LiveKit egress / Agora Cloud Recording), so callers that pick a player
 * should test for ".m3u8".
 */
export function liveReplayUrl(s: ReplaySource): string | null {
  if (s.status !== "ended" || !s.recording_path) return null;
  const ivs = Boolean(s.ivs_channel_arn) || Boolean(s.ivs_stage_arn);
  const canReplay = ivs || Boolean(s.agora_channel) || Boolean(s.livekit_room);
  if (!canReplay) return null;
  // Each provider resolves against ITS OWN base only — with several bases
  // configured, a first-match chain would send e.g. an Agora recording to the
  // LiveKit egress bucket. The media CDN stays the shared last resort.
  return (
    (ivs ? ivsRecordingUrl(s.recording_path) : null) ??
    (s.livekit_room ? recordingPlaybackUrl(s.recording_path) : null) ??
    (s.agora_channel ? agoraRecordingUrl(s.recording_path) : null) ??
    mediaUrl(s.recording_path)
  );
}
