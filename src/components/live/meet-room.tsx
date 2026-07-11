"use client";

import * as React from "react";
import {
  Copy,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AuthorSummary } from "@/types/social";

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

interface Peer {
  pc: RTCPeerConnection;
  stream: MediaStream;
  name: string;
}

type SignalPayload = {
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

/**
 * A Zoom / Google-Meet-style multi-party video room. Everyone who opens the
 * same room id joins a WebRTC *mesh*: each pair of participants holds a direct
 * peer connection, so media flows P2P (no media server). Supabase Realtime
 * carries presence (who's here) and the offer/answer/ICE signalling. A
 * deterministic rule — the lexicographically smaller id makes the offer —
 * ensures exactly one side initiates per pair.
 */
export function MeetRoom({
  roomId,
  currentUser,
  onLeave,
}: {
  roomId: string;
  currentUser: AuthorSummary;
  onLeave: () => void;
}) {
  const me = currentUser.id;
  const myName =
    currentUser.full_name || currentUser.username || "You";

  const [peers, setPeers] = React.useState<Record<string, Peer>>({});
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [sharing, setSharing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const localRef = React.useRef<HTMLVideoElement>(null);
  const localStream = React.useRef<MediaStream | null>(null);
  const cameraTrack = React.useRef<MediaStreamTrack | null>(null);
  const channelRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const pcs = React.useRef<Record<string, RTCPeerConnection>>({});
  const peersRef = React.useRef(peers);
  peersRef.current = peers;

  // Create (or fetch) a peer connection to `other`, wired for media + ICE.
  const ensurePc = React.useCallback(
    (other: string, name: string): RTCPeerConnection => {
      const existing = pcs.current[other];
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      pcs.current[other] = pc;

      localStream.current
        ?.getTracks()
        .forEach((t) => pc.addTrack(t, localStream.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              from: me,
              to: other,
              kind: "ice",
              candidate: e.candidate.toJSON(),
            } satisfies SignalPayload,
          });
        }
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        setPeers((prev) => ({
          ...prev,
          [other]: { pc, stream, name },
        }));
      };
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          removePeer(other);
        }
      };
      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me],
  );

  function removePeer(other: string) {
    const pc = pcs.current[other];
    if (pc) {
      pc.close();
      delete pcs.current[other];
    }
    setPeers((prev) => {
      const next = { ...prev };
      delete next[other];
      return next;
    });
  }

  // Initiate an offer to `other` (only the smaller id does this per pair).
  const callPeer = React.useCallback(
    async (other: string, name: string) => {
      const pc = ensurePc(other, name);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      void channelRef.current?.send({
        type: "broadcast",
        event: "signal",
        payload: { from: me, to: other, kind: "offer", sdp: offer },
      });
    },
    [ensurePc, me],
  );

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const channel = supabase.channel(`meet:${roomId}`, {
      config: { presence: { key: me } },
    });
    channelRef.current = channel;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream.current = stream;
        cameraTrack.current = stream.getVideoTracks()[0] ?? null;
        if (localRef.current) localRef.current.srcObject = stream;
      } catch {
        setError("ကင်မရာ/မိုက် ခွင့်ပြုချက် လိုအပ်ပါသည်။");
        return;
      }

      channel
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
          const p = payload as SignalPayload;
          if (p.to !== me) return;
          const state = channel.presenceState() as Record<
            string,
            { name?: string }[]
          >;
          const name = state[p.from]?.[0]?.name ?? "Guest";
          const pc = ensurePc(p.from, name);
          if (p.kind === "offer" && p.sdp) {
            await pc.setRemoteDescription(p.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            void channel.send({
              type: "broadcast",
              event: "signal",
              payload: { from: me, to: p.from, kind: "answer", sdp: answer },
            });
          } else if (p.kind === "answer" && p.sdp) {
            await pc.setRemoteDescription(p.sdp);
          } else if (p.kind === "ice" && p.candidate) {
            try {
              await pc.addIceCandidate(p.candidate);
            } catch {
              /* ignore late candidates */
            }
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState() as Record<
            string,
            { name?: string }[]
          >;
          for (const key of Object.keys(state)) {
            if (key === me) continue;
            const name = state[key]?.[0]?.name ?? "Guest";
            // Smaller id initiates; only if no connection yet.
            if (me < key && !pcs.current[key]) void callPeer(key, name);
          }
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          for (const pres of leftPresences as { key?: string }[]) {
            if (pres.key) removePeer(pres.key);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ name: myName, avatar: currentUser.avatar_url });
          }
        });
    }

    void init();

    return () => {
      cancelled = true;
      Object.values(pcs.current).forEach((pc) => pc.close());
      pcs.current = {};
      localStream.current?.getTracks().forEach((t) => t.stop());
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, me]);

  function toggleMic() {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  async function toggleShare() {
    if (sharing) {
      // Back to camera.
      const cam = cameraTrack.current;
      if (cam) replaceVideoTrack(cam);
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      replaceVideoTrack(screenTrack);
      setSharing(true);
      screenTrack.onended = () => {
        const cam = cameraTrack.current;
        if (cam) replaceVideoTrack(cam);
        setSharing(false);
      };
    } catch {
      /* user cancelled */
    }
  }

  function replaceVideoTrack(track: MediaStreamTrack) {
    Object.values(pcs.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      void sender?.replaceTrack(track);
    });
    if (localRef.current && localStream.current) {
      const preview = new MediaStream([
        track,
        ...localStream.current.getAudioTracks(),
      ]);
      localRef.current.srcObject = preview;
    }
  }

  function copyLink() {
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  }

  const remote = Object.entries(peers);
  const count = remote.length + 1;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">🎓 Live Class · {count} ဦး</p>
          <p className="text-xs text-muted-foreground">Room: {roomId}</p>
        </div>
        <Button size="sm" variant="outline" onClick={copyLink}>
          <Copy className="mr-1 h-4 w-4" /> {copied ? "ကူးပြီး" : "Link ကူးရန်"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div
        className="grid flex-1 gap-2 overflow-y-auto"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {/* Self */}
        <Tile name={`${myName} (သင်)`} muted>
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </Tile>
        {/* Remotes */}
        {remote.map(([id, peer]) => (
          <RemoteTile key={id} peer={peer} />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 py-1">
        <ControlButton on={micOn} onClick={toggleMic} label="mic">
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton on={camOn} onClick={toggleCam} label="camera">
          {camOn ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </ControlButton>
        <ControlButton on={sharing} onClick={() => void toggleShare()} label="share" active>
          <MonitorUp className="h-5 w-5" />
        </ControlButton>
        <button
          type="button"
          onClick={onLeave}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-white"
          aria-label="Leave"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  on,
  active,
  onClick,
  label,
  children,
}: {
  on: boolean;
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full",
        active
          ? on
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
          : on
            ? "bg-muted text-foreground"
            : "bg-destructive text-white",
      )}
    >
      {children}
    </button>
  );
}

function Tile({
  name,
  muted,
  children,
}: {
  name: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      {children}
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {name}
        {muted ? " 🔇" : ""}
      </span>
    </div>
  );
}

function RemoteTile({ peer }: { peer: Peer }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.srcObject = peer.stream;
  }, [peer.stream]);
  return (
    <Tile name={peer.name}>
      <video
        ref={ref}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
    </Tile>
  );
}
