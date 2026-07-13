"use client";

import "@livekit/components-styles";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  LiveKitRoom,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Loader2, Radio } from "lucide-react";

import { getLiveStageToken, goLive } from "@/lib/actions/live";
import type { LiveStreamStatus } from "@/types/database";

import { LiveMediaShare } from "./live-media-share";

interface Conn {
  url: string;
  token: string;
  canPublish: boolean;
}

/**
 * Single-broadcaster Live over the LiveKit SFU. The host publishes camera/mic
 * straight from the browser; viewers subscribe only, so one broadcast reaches
 * thousands of viewers with no Mux account and no OBS. Chat, gifts, reactions
 * and Live Sale live outside this component and are provider-agnostic.
 */
export function LiveStage({
  streamId,
  isHost,
  status,
}: {
  streamId: string;
  isHost: boolean;
  status: LiveStreamStatus;
}) {
  const router = useRouter();
  const [conn, setConn] = React.useState<Conn | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status === "ended") return;
    // Viewers only need to connect once the broadcast is live; the host
    // connects immediately so they can start it.
    if (!isHost && status !== "live") return;
    let active = true;
    getLiveStageToken(streamId).then((res) => {
      if (!active) return;
      if (res.ok) setConn(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [streamId, isHost, status]);

  if (status === "ended") {
    return (
      <Placeholder text="ဒီ Live ပြီးဆုံးသွားပါပြီ။" />
    );
  }

  if (!isHost && status !== "live") {
    return <Placeholder text="Live စတင်ရန် စောင့်နေသည်…" pulse />;
  }

  if (error) {
    return <Placeholder text={error} />;
  }
  if (!conn) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      video={conn.canPublish}
      audio={conn.canPublish}
      data-lk-theme="default"
      className="overflow-hidden rounded-xl border bg-black"
      style={{ aspectRatio: "16 / 9", width: "100%" }}
      onConnected={
        isHost ? () => void goLive(streamId).then(() => router.refresh()) : undefined
      }
    >
      <Stage isHost={isHost} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function Stage({ isHost }: { isHost: boolean }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        {tracks.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">
            {isHost
              ? "ကင်မရာ/မိုက် ဖွင့်ပြီး Live စတင်ပါ။"
              : "ကင်မရာ စောင့်နေသည်…"}
          </div>
        ) : (
          <GridLayout tracks={tracks} className="h-full">
            <ParticipantTile />
          </GridLayout>
        )}
      </div>
      {isHost ? (
        <>
          <LiveMediaShare />
          <ControlBar
            variation="minimal"
            controls={{
              microphone: true,
              camera: true,
              screenShare: true,
              chat: false,
              leave: false,
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function Placeholder({ text, pulse }: { text: string; pulse?: boolean }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted text-muted-foreground">
      <Radio className={`h-8 w-8 ${pulse ? "animate-pulse" : ""}`} />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
