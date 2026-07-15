"use client";

import * as React from "react";
import {
  Camera,
  Loader2,
  Maximize,
  RotateCw,
  Share2,
  VideoOff,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { createPost } from "@/lib/actions/posts";
import { uploadMedia } from "@/lib/media";

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
 * Recovers on its own — if the master drops or the session expires it retries
 * with a short backoff, so a camera comes back without a page refresh.
 *
 * Pass `id` for the owner's own view, or `token` for a public share link.
 * `compact` hides the controls for the multi-camera wall.
 */
export function KvsPlayer({
  id,
  token,
  title,
  compact = false,
  shareUserId,
  motion = true,
}: {
  id?: string;
  token?: string;
  title: string;
  compact?: boolean;
  /** When set, a "share to feed" button posts a snapshot as this user. */
  shareUserId?: string;
  /** Client-side motion badge (default on). */
  motion?: boolean;
}) {
  const t = useTranslations("cctv");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<Status>("connecting");
  const [attempt, setAttempt] = React.useState(0);
  const [moving, setMoving] = React.useState(false);
  const [sharing, setSharing] = React.useState<"idle" | "busy" | "done">("idle");

  React.useEffect(() => {
    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let tries = 0;
    let signaling: {
      on: (e: string, cb: (arg?: unknown) => void) => void;
      open: () => void;
      close: () => void;
      sendSdpOffer: (sdp: RTCSessionDescription) => void;
      sendIceCandidate: (c: RTCIceCandidate) => void;
    } | null = null;

    function scheduleReconnect() {
      if (cancelled) return;
      setStatus("error");
      tries += 1;
      // Cap the backoff at 15s; keep retrying so a camera self-heals.
      const delay = Math.min(2000 * tries, 15000);
      retry = setTimeout(() => {
        if (!cancelled) void connect();
      }, delay);
    }

    function teardown() {
      try {
        signaling?.close();
      } catch {
        /* ignore */
      }
      signaling = null;
      if (pc) {
        pc.getReceivers().forEach((r) => r.track?.stop());
        pc.close();
        pc = null;
      }
    }

    async function connect() {
      teardown();
      if (!cancelled) setStatus("connecting");
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
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        pc.addEventListener("track", (event) => {
          const [stream] = event.streams;
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            tries = 0;
            setStatus("live");
          }
        });
        pc.addEventListener("icecandidate", ({ candidate }) => {
          if (candidate) signaling?.sendIceCandidate(candidate);
        });
        pc.addEventListener("connectionstatechange", () => {
          if (
            pc &&
            (pc.connectionState === "failed" ||
              pc.connectionState === "disconnected")
          ) {
            scheduleReconnect();
          }
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
        signaling!.on("error", scheduleReconnect);
        signaling!.on("close", scheduleReconnect);

        signaling!.open();
      } catch {
        scheduleReconnect();
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      teardown();
    };
    // `attempt` lets the manual "retry" button force a fresh connect.
  }, [id, token, attempt]);

  function snapshot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const link = document.createElement("a");
    link.download = `${title.replace(/\s+/g, "-")}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function fullscreen() {
    containerRef.current?.requestFullscreen?.();
  }

  // Lightweight client-side motion detection: downscale each frame and compare
  // the mean pixel delta against the previous one. No server, no ML — just a
  // "movement seen" badge that decays after a couple of seconds.
  React.useEffect(() => {
    if (!motion || status !== "live") return;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let prev: Uint8ClampedArray | null = null;
    let decay: ReturnType<typeof setTimeout> | null = null;

    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || !ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (prev) {
        let diff = 0;
        for (let i = 0; i < data.length; i += 4) {
          diff += Math.abs((data[i] ?? 0) - (prev[i] ?? 0));
        }
        const mean = diff / (data.length / 4);
        if (mean > 12) {
          setMoving(true);
          if (decay) clearTimeout(decay);
          decay = setTimeout(() => setMoving(false), 2500);
        }
      }
      prev = data.slice(0);
    }, 500);

    return () => {
      clearInterval(timer);
      if (decay) clearTimeout(decay);
      setMoving(false);
    };
  }, [motion, status]);

  async function shareSnapshot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !shareUserId) return;
    setSharing("busy");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("capture failed");
      const file = new File([blob], `${title}.png`, { type: "image/png" });
      const media = await uploadMedia(shareUserId, file);
      const res = await createPost({
        content: `📷 ${title}`,
        visibility: "friends",
        media: [media],
      });
      setSharing(res.ok ? "done" : "idle");
    } catch {
      setSharing("idle");
    }
  }

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl border bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls={!compact}
        className="h-full w-full"
      />

      {/* Live badge + controls (hidden in compact wall tiles until hover) */}
      {status === "live" ? (
        <>
          <div className="absolute left-2 top-2 flex items-center gap-1">
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              LIVE
            </span>
            {moving ? (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-black">
                {t("motion")}
              </span>
            ) : null}
          </div>
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {shareUserId ? (
              <button
                type="button"
                onClick={shareSnapshot}
                disabled={sharing === "busy"}
                aria-label={t("shareSnapshot")}
                className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 disabled:opacity-60"
              >
                {sharing === "busy" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={snapshot}
              aria-label={t("snapshot")}
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fullscreen}
              aria-label={t("fullscreen")}
              className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}

      {status !== "live" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center text-white">
          {status === "connecting" ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin" />
              {!compact ? <p className="text-sm">{t("kvsConnecting")}</p> : null}
            </>
          ) : (
            <>
              <VideoOff className="h-7 w-7 opacity-80" />
              {!compact ? (
                <>
                  <p className="text-sm font-medium">{t("kvsError")}</p>
                  <p className="max-w-xs px-4 text-xs opacity-80">
                    {t("kvsErrorHint")}
                  </p>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25"
              >
                <RotateCw className="h-3 w-3" /> {t("retry")}
              </button>
            </>
          )}
          <span className="sr-only">{title}</span>
        </div>
      ) : null}
    </div>
  );
}
