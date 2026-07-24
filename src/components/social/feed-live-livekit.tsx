"use client";

import * as React from "react";
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

import { getLiveStageToken } from "@/lib/actions/live";

/**
 * Inline, muted auto-playing viewer for a LiveKit (browser "Go Live") broadcast
 * inside the feed. Browser lives have no HLS URL, so the plain <video> preview
 * used for IVS streams can't show them — this connects as a WebRTC *subscriber*
 * and renders the host's camera track.
 *
 * Cost control: it only connects while `active` is true — the parent flips that
 * on with an IntersectionObserver, so a live room is joined only while its card
 * is actually on screen, and left the moment it scrolls away.
 */
export function FeedLiveKitPreview({
  streamId,
  active,
}: {
  streamId: string;
  active: boolean;
}) {
  const [conn, setConn] = React.useState<{ url: string; token: string } | null>(
    null,
  );

  React.useEffect(() => {
    if (!active) {
      setConn(null); // disconnect when the card leaves the viewport
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await getLiveStageToken(streamId);
      if (!cancelled && res.ok) {
        setConn({ url: res.data.url, token: res.data.token });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streamId, active]);

  if (!conn) return null;

  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      // We only watch: never publish this viewer's mic/cam.
      audio={false}
      video={false}
      className="h-full w-full"
    >
      <FirstCameraTile />
    </LiveKitRoom>
  );
}

/** Render the first subscribed camera track (the host), muted, filling the box. */
function FirstCameraTile() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const cam = tracks.find((t) => t.publication?.isSubscribed);
  if (!cam) return null;
  return (
    <VideoTrack trackRef={cam} className="h-full w-full object-cover" />
  );
}
