"use client";

import "@livekit/components-styles";

import * as React from "react";
import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  LiveKitRoom,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { Hand, Loader2, Radio, Users } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { approveCohost, getCohostStageToken } from "@/lib/actions/cohost";
import { displayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AuthorSummary } from "@/types/social";

interface Conn {
  url: string;
  token: string;
  canPublish: boolean;
  isHost: boolean;
}

type RaisePayload = { userId: string; name: string };

/**
 * Co-host Live over the LiveKit SFU. A small set of publishers (the host and
 * approved co-hosts) send camera/mic; the media server fans those streams out
 * to everyone else, so the room scales to thousands of viewers. Viewers can
 * "raise a hand" to ask the host to bring them on camera.
 */
export function CohostStage({
  code,
  currentUser,
}: {
  code: string;
  currentUser: AuthorSummary;
}) {
  const [conn, setConn] = React.useState<Conn | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const reconnect = React.useCallback(() => setReloadKey((k) => k + 1), []);

  React.useEffect(() => {
    let active = true;
    getCohostStageToken(code).then((res) => {
      if (!active) return;
      if (res.ok) {
        setConn(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
    });
    return () => {
      active = false;
    };
  }, [code, reloadKey]);

  if (error) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!conn) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <LiveKitRoom
      // Remount when publish permission changes so we reconnect with the new
      // (publish) token after the host promotes this viewer.
      key={conn.canPublish ? "publisher" : "viewer"}
      serverUrl={conn.url}
      token={conn.token}
      connect
      video={conn.canPublish}
      audio={conn.canPublish}
      data-lk-theme="default"
      className="overflow-hidden rounded-xl border bg-black"
      style={{ height: "72vh" }}
    >
      <StageBody
        code={code}
        currentUser={currentUser}
        canPublish={conn.canPublish}
        isHost={conn.isHost}
        onPromoted={reconnect}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function StageBody({
  code,
  currentUser,
  canPublish,
  isHost,
  onPromoted,
}: {
  code: string;
  currentUser: AuthorSummary;
  canPublish: boolean;
  isHost: boolean;
  onPromoted: () => void;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const supabase = React.useMemo(() => createClient(), []);
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const [requests, setRequests] = React.useState<RaisePayload[]>([]);
  const [raised, setRaised] = React.useState(false);

  React.useEffect(() => {
    const channel = supabase.channel(`cohost-stage-${code}`, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "raise" }, ({ payload }) => {
      if (!isHost) return;
      const p = payload as RaisePayload;
      setRequests((prev) =>
        prev.some((x) => x.userId === p.userId) ? prev : [...prev, p],
      );
    });
    channel.on("broadcast", { event: "promoted" }, ({ payload }) => {
      if ((payload as { userId: string }).userId === currentUser.id) {
        onPromoted();
      }
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code, isHost, currentUser.id, onPromoted, supabase]);

  async function raiseHand() {
    setRaised(true);
    await channelRef.current?.send({
      type: "broadcast",
      event: "raise",
      payload: { userId: currentUser.id, name: displayName(currentUser) },
    });
  }

  async function approve(userId: string) {
    const res = await approveCohost(code, userId);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    await channelRef.current?.send({
      type: "broadcast",
      event: "promoted",
      payload: { userId },
    });
    setRequests((prev) => prev.filter((x) => x.userId !== userId));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 bg-black/60 px-3 py-2 text-white">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Radio className="h-3.5 w-3.5 text-red-500" /> LIVE
          <ViewerCount />
        </span>
        {!canPublish ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={raiseHand}
            disabled={raised}
          >
            <Hand className="mr-1 h-4 w-4" />
            {raised ? "လက်ထောင်ပြီး" : "Co-host ဝင်ရန်"}
          </Button>
        ) : null}
      </div>

      <div className="relative flex-1 overflow-hidden">
        {tracks.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">
            ကင်မရာ စောင့်နေသည်… host ကင်မရာ ဖွင့်သည်နှင့် ဒီမှာ ပေါ်လာပါမည်။
          </div>
        ) : (
          <GridLayout tracks={tracks} className="h-full">
            <ParticipantTile />
          </GridLayout>
        )}
      </div>

      {isHost && requests.length > 0 ? (
        <div className="space-y-1.5 bg-black/70 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-white/80">
            <Hand className="h-3.5 w-3.5" /> Co-host ဝင်ခွင့် တောင်းထားသူများ
          </p>
          <div className="flex flex-wrap gap-1.5">
            {requests.map((r) => (
              <button
                key={r.userId}
                onClick={() => approve(r.userId)}
                className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {r.name} ✓ ခွင့်ပြု
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canPublish ? (
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
      ) : null}
    </div>
  );
}

/** Live viewer/participant count read from the room without re-rendering per join. */
function ViewerCount() {
  const room = useRoomContext();
  const [n, setN] = React.useState(room.numParticipants);
  React.useEffect(() => {
    const update = () => setN(room.numParticipants);
    room
      .on(RoomEvent.ParticipantConnected, update)
      .on(RoomEvent.ParticipantDisconnected, update)
      .on(RoomEvent.Connected, update);
    update();
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, update)
        .off(RoomEvent.ParticipantDisconnected, update)
        .off(RoomEvent.Connected, update);
    };
  }, [room]);
  return (
    <span className="ml-1 flex items-center gap-1 text-white/80">
      <Users className="h-3.5 w-3.5" /> {n + 1}
    </span>
  );
}
