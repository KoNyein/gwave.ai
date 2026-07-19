"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AudioLines,
  Loader2,
  Mic,
  MicOff,
  Radio,
  RefreshCcw,
  Sparkles,
  Video,
  VideoOff,
  X,
} from "lucide-react";

import { getIvsStageToken, goLive } from "@/lib/actions/live";
import type { LiveStreamStatus } from "@/types/database";

/** Minimal structural types for the dynamically-imported IVS broadcast SDK —
 * importing its types statically would pull the whole SDK into the bundle. */
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

/**
 * The host's publish pipeline. The camera never goes to IVS directly — it is
 * drawn onto a canvas (with optional photo/music overlays) and the canvas'
 * captured track is what gets published. That one indirection makes everything
 * the host asked for cheap:
 *   • front/back camera flip = swap the track feeding the canvas (published
 *     track never changes, so no renegotiation)
 *   • ✨ photo effect = draw the image over the frame (transparent PNG = frame)
 *   • 🎶 music effect = mix the song into the published audio via WebAudio and
 *     paint an equaliser along the bottom
 */
interface Compositor {
  canvas: HTMLCanvasElement;
  videoEl: HTMLVideoElement;
  camTrack: MediaStreamTrack | null;
  micTrack: MediaStreamTrack | null;
  outVideo: MediaStreamTrack;
  outAudio: MediaStreamTrack;
  audioCtx: AudioContext;
  micSource: MediaStreamAudioSourceNode | null;
  mixDest: MediaStreamAudioDestinationNode;
  overlayImg: HTMLImageElement | null;
  musicEl: HTMLAudioElement | null;
  musicNodes: { analyser: AnalyserNode; bins: Uint8Array<ArrayBuffer> } | null;
  raf: number;
  stop(): void;
}

async function getCamMic(facing: "user" | "environment"): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: facing,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: true,
  });
}

async function createCompositor(
  facing: "user" | "environment",
): Promise<Compositor> {
  const media = await getCamMic(facing);
  const camTrack = media.getVideoTracks()[0] ?? null;
  const micTrack = media.getAudioTracks()[0] ?? null;

  const videoEl = document.createElement("video");
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.autoplay = true;
  if (camTrack) videoEl.srcObject = new MediaStream([camTrack]);
  await videoEl.play().catch(() => undefined);

  const s = camTrack?.getSettings() ?? {};
  const canvas = document.createElement("canvas");
  canvas.width = s.width ?? 1280;
  canvas.height = s.height ?? 720;
  const g = canvas.getContext("2d")!;

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioCtx = new AudioCtx();
  const mixDest = audioCtx.createMediaStreamDestination();
  let micSource: MediaStreamAudioSourceNode | null = null;
  if (micTrack) {
    micSource = audioCtx.createMediaStreamSource(new MediaStream([micTrack]));
    micSource.connect(mixDest);
  }

  const comp: Compositor = {
    canvas,
    videoEl,
    camTrack,
    micTrack,
    outVideo: canvas.captureStream(30).getVideoTracks()[0]!,
    outAudio: mixDest.stream.getAudioTracks()[0]!,
    audioCtx,
    micSource,
    mixDest,
    overlayImg: null,
    musicEl: null,
    musicNodes: null,
    raf: 0,
    stop() {
      cancelAnimationFrame(comp.raf);
      comp.musicEl?.pause();
      comp.camTrack?.stop();
      comp.micTrack?.stop();
      comp.outVideo.stop();
      comp.outAudio.stop();
      void comp.audioCtx.close().catch(() => undefined);
    },
  };

  const render = () => {
    if (videoEl.readyState >= 2) {
      g.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    } else {
      g.fillStyle = "#000";
      g.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (comp.overlayImg) {
      g.drawImage(comp.overlayImg, 0, 0, canvas.width, canvas.height);
    }
    if (comp.musicNodes) {
      const { analyser, bins } = comp.musicNodes;
      analyser.getByteFrequencyData(bins);
      const n = bins.length;
      const bw = canvas.width / n;
      g.save();
      g.globalAlpha = 0.85;
      for (let i = 0; i < n; i++) {
        const v = bins[i]! / 255;
        const bh = v * canvas.height * 0.28;
        g.fillStyle = `hsl(${140 + i * 2}, 90%, 55%)`;
        g.fillRect(i * bw, canvas.height - bh, bw * 0.82, bh);
      }
      g.restore();
    }
    comp.raf = requestAnimationFrame(render);
  };
  render();

  return comp;
}

/** Swap the camera feeding the canvas — the published track is untouched. */
async function flipCompositorCamera(
  comp: Compositor,
  facing: "user" | "environment",
): Promise<void> {
  const media = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { exact: facing } },
  }).catch(() => getCamMic(facing));
  const track = media.getVideoTracks()[0];
  if (!track) return;
  comp.camTrack?.stop();
  comp.camTrack = track;
  comp.videoEl.srcObject = new MediaStream([track]);
  await comp.videoEl.play().catch(() => undefined);
}

/** Orientation-adaptive aspect: match the played video's shape, clamped
 * 9:16…16:9, updating on rotation with a device fallback. */
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
 * Single-broadcaster Live on Amazon IVS Real-Time. Host publishes a composited
 * camera (flip / photo FX / music FX built in); viewers subscribe through
 * AWS's global edge. Chat, gifts, reactions and Live Sale live outside this
 * component and are provider-agnostic.
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
  const [facing, setFacing] = React.useState<"user" | "environment">("user");
  const [fx, setFx] = React.useState<"none" | "photo" | "music">("none");

  const compRef = React.useRef<Compositor | null>(null);
  const photoInput = React.useRef<HTMLInputElement>(null);
  const musicInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (status === "ended") return;
    if (!isHost && status !== "live") {
      setPhase("waiting");
      return;
    }

    let cancelled = false;
    let stage: IvsStageHandle | null = null;

    const cleanup = () => {
      compRef.current?.stop();
      compRef.current = null;
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
        const comp = await createCompositor("user");
        if (cancelled) {
          comp.stop();
          return;
        }
        compRef.current = comp;
        localStreams = [
          new LocalStageStream(comp.outVideo),
          new LocalStageStream(comp.outAudio),
        ];
        // Local preview = the composited canvas, so the host sees exactly what
        // viewers see (overlays included).
        if (stageRef.current) {
          comp.canvas.style.cssText = "width:100%;height:100%;object-fit:cover";
          stageRef.current.replaceChildren(comp.canvas);
        }
      }

      const strategy = {
        stageStreamsToPublish: () => localStreams,
        shouldPublishParticipant: () => res.data.canPublish,
        shouldSubscribeToParticipant: () => SubscribeType.AUDIO_VIDEO,
      };
      const s = new Stage(res.data.token, strategy) as unknown as IvsStageHandle;
      stage = s;

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
      cleanup();
    };
  }, [streamId, isHost, status, router]);

  const toggleMic = () => {
    const track = compRef.current?.micTrack;
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };
  const toggleCam = () => {
    const track = compRef.current?.camTrack;
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };
  const flipCamera = () => {
    const comp = compRef.current;
    if (!comp) return;
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    void flipCompositorCamera(comp, next);
  };

  const startPhotoFx = (file: File) => {
    const comp = compRef.current;
    if (!comp) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      comp.overlayImg = img;
      setFx("photo");
    };
    img.src = url;
  };
  const startMusicFx = (file: File) => {
    const comp = compRef.current;
    if (!comp) return;
    stopFx();
    const url = URL.createObjectURL(file);
    const el = document.createElement("audio");
    el.src = url;
    el.loop = true;
    const source = comp.audioCtx.createMediaElementSource(el);
    const analyser = comp.audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    source.connect(comp.mixDest); // viewers hear it
    source.connect(comp.audioCtx.destination); // host hears it
    void el.play().catch(() => undefined);
    comp.musicEl = el;
    comp.musicNodes = {
      analyser,
      bins: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
    };
    setFx("music");
  };
  const stopFx = () => {
    const comp = compRef.current;
    if (!comp) return;
    comp.overlayImg = null;
    comp.musicEl?.pause();
    comp.musicEl = null;
    comp.musicNodes = null;
    setFx("none");
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
          <>
            {/* TikTok-style right rail — keeps the bottom clear for the chat
                overlay on mobile. */}
            <div className="absolute right-2 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2">
              <ControlButton on={micOn} onClick={toggleMic} OnIcon={Mic} OffIcon={MicOff} />
              <ControlButton on={camOn} onClick={toggleCam} OnIcon={Video} OffIcon={VideoOff} />
              <ControlButton
                on
                onClick={flipCamera}
                OnIcon={RefreshCcw}
                OffIcon={RefreshCcw}
                label="ကင်မရာလှည့်"
              />
              <ControlButton
                on={fx !== "music"}
                onClick={() => musicInput.current?.click()}
                OnIcon={AudioLines}
                OffIcon={AudioLines}
                label="သီချင်း FX"
              />
              <ControlButton
                on={fx !== "photo"}
                onClick={() => photoInput.current?.click()}
                OnIcon={Sparkles}
                OffIcon={Sparkles}
                label="ဓာတ်ပုံ FX"
              />
              {fx !== "none" ? (
                <ControlButton on={false} onClick={stopFx} OnIcon={X} OffIcon={X} label="FX ရပ်" />
              ) : null}
            </div>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startPhotoFx(f);
                e.target.value = "";
              }}
            />
            <input
              ref={musicInput}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startMusicFx(f);
                e.target.value = "";
              }}
            />
          </>
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
  label,
}: {
  on: boolean;
  onClick: () => void;
  OnIcon: React.ComponentType<{ className?: string }>;
  OffIcon: React.ComponentType<{ className?: string }>;
  label?: string;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
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
