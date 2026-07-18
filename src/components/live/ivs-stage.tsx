"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, Radio, Video, VideoOff } from "lucide-react";

import { getIvsStageToken, goLive } from "@/lib/actions/live";
import type { LiveStreamStatus } from "@/types/database";

/** Minimal structural types for the dynamically-imported IVS broadcast SDK —
 * the package ships its own types, but importing them statically would pull the
 * whole SDK into the server bundle. */
interface IvsLocalStream {
  setMuted(muted: boolean): void;
}
interface IvsRemoteStream {
  streamType: string;
  mediaStreamTrack: MediaStreamTrack;
}
interface IvsParticipant {
  isLocal: boolean;
}
interface IvsStageHandle {
  join(): Promise<void>;
  leave(): void;
  on(event: string, cb: (...args: never[]) => void): void;
}

/** Orientation-adaptive aspect (same behaviour as the other stages): match the
 * played video's real shape, clamped 9:16…16:9, with a device fallback. */
function useStageAspect(container: React.RefObject<HTMLDivElement | null>): string {
  const portraitInit =
    typeof window !== "undefined" &&
    window.matchMedia?.("(orientation: portrait)").matches;
  const [aspect, setAspect] = React.useState(portraitInit ? "9 / 16" : "16 / 9");

  React.useEffect(() => {
    const measure = () => {
      const video = container.current?.querySelector("video");
      let ratio: number | null = null;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        ratio = video.videoWidth / video.videoHeight;
      } else if (window.matchMedia?.("(orientation: portrait)").matches) {
        ratio = 9 / 16;
      }
      if (ratio) {
        const clamped = Math.min(16 / 9, Math.max(9 / 16, ratio));
        setAspect(`${clamped.toFixed(4)} / 1`);
      }
    };
    measure();
    const id = window.setInterval(measure, 700);
    window.addEventListener("orientationchange", measure);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("orientationchange", measure);
      window.removeEventListener("resize", measure);
    };
  }, [container]);

  return aspect;
}

/**
 * Single-broadcaster Live on Amazon IVS Real-Time. The host publishes
 * camera/mic over WebRTC from the browser; viewers subscribe through AWS's
 * global edge (up to 10,000 per stage). Chat, gifts, reactions and Live Sale
 * live outside this component and are provider-agnostic. Mirrors the other
 * stages' props so the watch page picks a provider per stream.
 */
export function IvsStage({
  streamId,
  isHost,
  status,
}: {
  streamId: string;
  isHost: boolean;
  status: LiveStreamStatus;
}) {
  const router = useRouter();
  const stageRef = React.useRef<HTMLDivElement>(null);
  const aspect = useStageAspect(stageRef);

  const [phase, setPhase] = React.useState<
    "connecting" | "live" | "waiting" | "error"
  >("connecting");
  const [error, setError] = React.useState<string | null>(null);
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);

  const micRef = React.useRef<IvsLocalStream | null>(null);
  const camRef = React.useRef<IvsLocalStream | null>(null);

  React.useEffect(() => {
    if (status === "ended") return;
    if (!isHost && status !== "live") {
      setPhase("waiting");
      return;
    }

    let cancelled = false;
    let stage: IvsStageHandle | null = null;
    let media: MediaStream | null = null;

    const cleanup = () => {
      media?.getTracks().forEach((t) => t.stop());
      try {
        stage?.leave();
      } catch {
        // best-effort teardown
      }
    };

    const run = async () => {
      const res = await getIvsStageToken(streamId);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setPhase("error");
        return;
      }

      const sdk = await import("amazon-ivs-web-broadcast");
      if (cancelled) return;
      const { Stage, StageEvents, SubscribeType, LocalStageStream } = sdk;

      let localStreams: InstanceType<typeof LocalStageStream>[] = [];
      if (res.data.canPublish) {
        media = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (cancelled) {
          cleanup();
          return;
        }
        const camTrack = media.getVideoTracks()[0];
        const micTrack = media.getAudioTracks()[0];
        const camStream = camTrack ? new LocalStageStream(camTrack) : null;
        const micStream = micTrack ? new LocalStageStream(micTrack) : null;
        localStreams = [camStream, micStream].filter(
          (s): s is InstanceType<typeof LocalStageStream> => Boolean(s),
        );
        camRef.current = camStream;
        micRef.current = micStream;

        // Local preview of the host's own camera.
        if (camTrack && stageRef.current) {
          const video = document.createElement("video");
          video.srcObject = new MediaStream([camTrack]);
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.style.cssText = "width:100%;height:100%;object-fit:cover";
          stageRef.current.replaceChildren(video);
          void video.play().catch(() => undefined);
        }
      }

      const strategy = {
        stageStreamsToPublish: () => localStreams,
        shouldPublishParticipant: () => res.data.canPublish,
        shouldSubscribeToParticipant: () => SubscribeType.AUDIO_VIDEO,
      };
      const s = new Stage(res.data.token, strategy) as unknown as IvsStageHandle;
      stage = s;

      // Viewer path: render the host's tracks as they arrive.
      s.on(
        StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED,
        ((participant: IvsParticipant, streams: IvsRemoteStream[]) => {
          if (participant.isLocal || !stageRef.current) return;
          const videoTrack = streams.find(
            (st) => st.mediaStreamTrack.kind === "video",
          )?.mediaStreamTrack;
          const audioTrack = streams.find(
            (st) => st.mediaStreamTrack.kind === "audio",
          )?.mediaStreamTrack;
          if (videoTrack) {
            const video = document.createElement("video");
            video.srcObject = new MediaStream(
              audioTrack ? [videoTrack, audioTrack] : [videoTrack],
            );
            video.playsInline = true;
            video.autoplay = true;
            video.style.cssText = "width:100%;height:100%;object-fit:cover";
            stageRef.current.replaceChildren(video);
            void video.play().catch(() => undefined);
            if (!cancelled) setPhase("live");
          }
        }) as (...args: never[]) => void,
      );

      await s.join();
      if (cancelled) {
        cleanup();
        return;
      }

      if (res.data.canPublish) {
        setPhase("live");
        // Mark live + start the server-side composite recording.
        void goLive(streamId).then(() => router.refresh());
      } else {
        setPhase("waiting");
      }
    };

    run().catch((e) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : "Live connection failed");
      setPhase("error");
    });

    return () => {
      cancelled = true;
      micRef.current = null;
      camRef.current = null;
      cleanup();
    };
  }, [streamId, isHost, status, router]);

  const toggleMic = () => {
    if (!micRef.current) return;
    const next = !micOn;
    micRef.current.setMuted(!next);
    setMicOn(next);
  };
  const toggleCam = () => {
    if (!camRef.current) return;
    const next = !camOn;
    camRef.current.setMuted(!next);
    setCamOn(next);
  };

  if (status === "ended") {
    return <Placeholder text="ဒီ Live ပြီးဆုံးသွားပါပြီ။" />;
  }
  if (phase === "error") {
    return <Placeholder text={error ?? "Live connection failed"} />;
  }

  return (
    <div
      className="mx-auto overflow-hidden rounded-xl border bg-black transition-[aspect-ratio] duration-300"
      style={{ aspectRatio: aspect, width: "100%", maxHeight: "80vh" }}
    >
      <div className="relative flex h-full flex-col">
        <div ref={stageRef} className="relative flex-1" />

        {phase !== "live" ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/70">
            {phase === "connecting" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Radio className="h-5 w-5 animate-pulse" />
                {isHost ? "ကင်မရာ ဖွင့်နေသည်…" : "Live စတင်ရန် စောင့်နေသည်…"}
              </>
            )}
          </div>
        ) : null}

        {isHost && phase === "live" ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
            <ControlButton on={micOn} onClick={toggleMic} OnIcon={Mic} OffIcon={MicOff} />
            <ControlButton on={camOn} onClick={toggleCam} OnIcon={Video} OffIcon={VideoOff} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ControlButton({
  on,
  onClick,
  OnIcon,
  OffIcon,
}: {
  on: boolean;
  onClick: () => void;
  OnIcon: React.ComponentType<{ className?: string }>;
  OffIcon: React.ComponentType<{ className?: string }>;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full ${
        on ? "bg-white/20 text-white" : "bg-destructive text-destructive-foreground"
      } backdrop-blur transition-colors hover:bg-white/30`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted text-muted-foreground">
      <Radio className="h-8 w-8" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
