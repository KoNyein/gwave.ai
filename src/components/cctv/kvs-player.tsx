"use client";

import * as React from "react";
import { Loader2, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";

interface ViewerConfig {
  channelARN: string;
  region: string;
  wssEndpoint: string;
  iceServers: RTCIceServer[];
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
  clientId: string;
}

type Status = "connecting" | "live" | "error";

/**
 * Plays a KVS WebRTC camera as a *viewer*: fetches a short-lived session from
 * /api/cctv/kvs, opens the signaling channel, negotiates a peer connection with
 * the local master and renders the incoming track. Sub-second, peer-to-peer.
 *
 * Pass `id` for the owner's own view, or `token` for a public share link.
 */
export function KvsPlayer({
  id,
  token,
  title,
}: {
  id?: string;
  token?: string;
  title: string;
}) {
  const t = useTranslations("cctv");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [status, setStatus] = React.useState<Status>("connecting");

  React.useEffect(() => {
    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    // The signaling client from the KVS SDK; typed loosely to avoid a hard
    // import at module scope (the SDK touches browser globals).
    let signaling: {
      on: (e: string, cb: (arg?: unknown) => void) => void;
      open: () => void;
      close: () => void;
      sendSdpOffer: (sdp: RTCSessionDescription) => void;
      sendIceCandidate: (c: RTCIceCandidate) => void;
    } | null = null;

    async function connect() {
      try {
        const res = await fetch("/api/cctv/kvs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(id ? { id } : { token }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const cfg: ViewerConfig = await res.json();
        if (cancelled) return;

        const { SignalingClient, Role } = await import(
          "amazon-kinesis-video-streams-webrtc"
        );

        signaling = new SignalingClient({
          channelARN: cfg.channelARN,
          channelEndpoint: cfg.wssEndpoint,
          clientId: cfg.clientId,
          role: Role.VIEWER,
          region: cfg.region,
          credentials: cfg.credentials,
          systemClockOffset: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        pc = new RTCPeerConnection({ iceServers: cfg.iceServers });
        // Viewer only receives media.
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        pc.addEventListener("track", (event) => {
          const [stream] = event.streams;
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            setStatus("live");
          }
        });
        pc.addEventListener("icecandidate", ({ candidate }) => {
          if (candidate) signaling?.sendIceCandidate(candidate);
        });

        signaling!.on("open", async () => {
          const offer = await pc!.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc!.setLocalDescription(offer);
          if (pc!.localDescription) signaling!.sendSdpOffer(pc!.localDescription);
        });
        signaling!.on("sdpAnswer", async (answer) => {
          await pc!.setRemoteDescription(answer as RTCSessionDescriptionInit);
        });
        signaling!.on("iceCandidate", (candidate) => {
          void pc!.addIceCandidate(candidate as RTCIceCandidateInit);
        });
        signaling!.on("error", () => {
          if (!cancelled) setStatus("error");
        });

        signaling!.open();
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void connect();

    return () => {
      cancelled = true;
      try {
        signaling?.close();
      } catch {
        /* ignore */
      }
      if (pc) {
        pc.getReceivers().forEach((r) => r.track?.stop());
        pc.close();
      }
    };
  }, [id, token]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        className="h-full w-full"
      />
      {status !== "live" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center text-white">
          {status === "connecting" ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">{t("kvsConnecting")}</p>
            </>
          ) : (
            <>
              <VideoOff className="h-8 w-8 opacity-80" />
              <p className="text-sm font-medium">{t("kvsError")}</p>
              <p className="max-w-xs px-4 text-xs opacity-80">{t("kvsErrorHint")}</p>
            </>
          )}
          <span className="sr-only">{title}</span>
        </div>
      ) : null}
    </div>
  );
}
