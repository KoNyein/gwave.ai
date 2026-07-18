"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, Radio, Video, VideoOff } from "lucide-react";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

import { getAgoraStageToken, goLive } from "@/lib/actions/live";
import type { LiveStreamStatus } from "@/types/database";

/**
 * Keep the stage matched to the real video's shape — a phone held upright
 * publishes a portrait frame, and a fixed 16:9 box would crop it to a sliver.
 * Reads the played <video>'s dimensions, clamped 9:16…16:9, updating on rotation
 * with a device-orientation fallback before the first frame.
 */
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
 * Single-broadcaster Live over Agora's managed WebRTC network. The host
 * publishes camera/mic from the browser; viewers subscribe only, so one
 * broadcast reaches thousands with no media server of ours. Chat, gifts,
 * reactions and Live Sale live outside this component and are provider-agnostic.
 *
 * Mirrors LiveStage's props so the watch page can pick a provider per stream.
 */
export function AgoraStage({
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

  const micRef = React.useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = React.useRef<ICameraVideoTrack | null>(null);

  React.useEffect(() => {
    if (status === "ended") return;
    // Viewers only connect once the broadcast is live; the host connects
    // immediately so they can start it.
    if (!isHost && status !== "live") {
      setPhase("waiting");
      return;
    }

    let cancelled = false;
    let client: IAgoraRTCClient | null = null;
    let mic: IMicrophoneAudioTrack | null = null;
    let cam: ICameraVideoTrack | null = null;

    const cleanup = () => {
      try {
        if (cam) cam.stop();
        if (mic) mic.stop();
        cam?.close();
        mic?.close();
        client?.removeAllListeners();
        void client?.leave().catch(() => {});
      } catch {
        // best-effort teardown
      }
    };

    const run = async () => {
      const res = await getAgoraStageToken(streamId);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setPhase("error");
        return;
      }
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      if (cancelled) return;

      client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      await client.setClientRole(res.data.canPublish ? "host" : "audience");

      // Viewer path: play the host's stream as it arrives.
      client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType) => {
        try {
          await client!.subscribe(user, mediaType);
        } catch {
          return;
        }
        if (mediaType === "video" && stageRef.current) {
          stageRef.current.replaceChildren();
          user.videoTrack?.play(stageRef.current);
          if (!cancelled) setPhase("live");
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });
      client.on("user-unpublished", (_user, mediaType) => {
        if (mediaType === "video" && stageRef.current) {
          stageRef.current.replaceChildren();
        }
      });

      await client.join(
        res.data.appId,
        res.data.channel,
        res.data.token,
        res.data.uid,
      );
      if (cancelled) {
        cleanup();
        return;
      }

      if (res.data.canPublish) {
        [mic, cam] = await AgoraRTC.createMicrophoneAndCameraTracks(
          {},
          { encoderConfig: "720p_2" },
        );
        if (cancelled) {
          cleanup();
          return;
        }
        micRef.current = mic;
        camRef.current = cam;
        if (stageRef.current) {
          stageRef.current.replaceChildren();
          cam.play(stageRef.current);
        }
        await client.publish([mic, cam]);
        if (cancelled) {
          cleanup();
          return;
        }
        setPhase("live");
        // Mark live + kick off server-side cloud recording.
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
    const track = micRef.current;
    if (!track) return;
    const next = !micOn;
    void track.setMuted(!next);
    setMicOn(next);
  };
  const toggleCam = () => {
    const track = camRef.current;
    if (!track) return;
    const next = !camOn;
    void track.setMuted(!next);
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
        {/* Agora plays the active video (host camera or remote host) in here. */}
        <div ref={stageRef} className="relative flex-1 [&_video]:!object-cover" />

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
            <ControlButton
              on={micOn}
              onClick={toggleMic}
              OnIcon={Mic}
              OffIcon={MicOff}
            />
            <ControlButton
              on={camOn}
              onClick={toggleCam}
              OnIcon={Video}
              OffIcon={VideoOff}
            />
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
