"use client";

import * as React from "react";
import { useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Film, Image as ImageIcon, Music, Square, Volume2 } from "lucide-react";

// Host-only "advanced Live" media sharing. On top of the camera/mic, the host
// can push extra tracks into the same LiveKit room:
//   • Background music / audio  → a screen-share audio track (mixed via Web
//     Audio so the host hears it locally too)
//   • Video file                → a screen-share video + audio track
//   • Photo                     → a static canvas captured as a video track
// Everything is unpublished and cleaned up on "Stop".

type CaptureEl = HTMLVideoElement & { captureStream?: () => MediaStream };

interface Sharing {
  kind: "music" | "audio" | "video" | "photo";
  tracks: MediaStreamTrack[];
  cleanup: () => void;
}

export function LiveMediaShare() {
  const room = useRoomContext();
  const [sharing, setSharing] = React.useState<Sharing | null>(null);
  const [busy, setBusy] = React.useState(false);

  const stop = React.useCallback(async () => {
    if (!sharing) return;
    for (const track of sharing.tracks) {
      try {
        await room.localParticipant.unpublishTrack(track);
      } catch {
        /* already gone */
      }
      track.stop();
    }
    sharing.cleanup();
    setSharing(null);
  }, [room, sharing]);

  // Tear down if the component unmounts (host leaves / stream ends).
  React.useEffect(() => {
    return () => {
      sharing?.tracks.forEach((t) => t.stop());
      sharing?.cleanup();
    };
  }, [sharing]);

  async function shareAudio(file: File, kind: "music" | "audio") {
    const url = URL.createObjectURL(file);
    const el = document.createElement("audio");
    el.src = url;
    el.loop = kind === "music";
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(el);
    const dest = ctx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(ctx.destination); // host hears it too
    await el.play();
    const track = dest.stream.getAudioTracks()[0]!;
    await room.localParticipant.publishTrack(track, {
      source: Track.Source.ScreenShareAudio,
      name: kind === "music" ? "bg-music" : "shared-audio",
    });
    setSharing({
      kind,
      tracks: [track],
      cleanup: () => {
        el.pause();
        void ctx.close().catch(() => {});
        URL.revokeObjectURL(url);
      },
    });
  }

  async function shareVideo(file: File) {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video") as CaptureEl;
    el.src = url;
    el.loop = true;
    el.muted = false;
    await el.play();
    const stream = el.captureStream?.();
    if (!stream) throw new Error("capture unsupported");
    const tracks: MediaStreamTrack[] = [];
    const vTrack = stream.getVideoTracks()[0];
    if (vTrack) {
      await room.localParticipant.publishTrack(vTrack, {
        source: Track.Source.ScreenShare,
        name: "shared-video",
      });
      tracks.push(vTrack);
    }
    const aTrack = stream.getAudioTracks()[0];
    if (aTrack) {
      await room.localParticipant.publishTrack(aTrack, {
        source: Track.Source.ScreenShareAudio,
        name: "shared-video-audio",
      });
      tracks.push(aTrack);
    }
    setSharing({
      kind: "video",
      tracks,
      cleanup: () => {
        el.pause();
        URL.revokeObjectURL(url);
      },
    });
  }

  async function sharePhoto(file: File) {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, canvas.width, canvas.height);
    // contain-fit
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    g.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    const stream = canvas.captureStream(1);
    const vTrack = stream.getVideoTracks()[0]!;
    await room.localParticipant.publishTrack(vTrack, {
      source: Track.Source.ScreenShare,
      name: "shared-photo",
    });
    setSharing({
      kind: "photo",
      tracks: [vTrack],
      cleanup: () => URL.revokeObjectURL(url),
    });
  }

  function pick(
    accept: string,
    handler: (file: File) => Promise<void>,
  ) {
    if (busy || sharing) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        await handler(file);
      } catch {
        // Unsupported format / capture failure — leave the live untouched.
      } finally {
        setBusy(false);
      }
    };
    input.click();
  }

  if (sharing) {
    const label =
      sharing.kind === "music"
        ? "🎵 နောက်ခံသီချင်း ဖွင့်နေသည်"
        : sharing.kind === "audio"
          ? "🔊 Audio ဖွင့်နေသည်"
          : sharing.kind === "video"
            ? "🎬 Video ဖွင့်နေသည်"
            : "🖼 Photo ပြသနေသည်";
    return (
      <div className="flex items-center justify-between gap-2 bg-black/60 px-3 py-2 text-sm text-white">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => void stop()}
          className="flex items-center gap-1 rounded-full bg-destructive px-3 py-1 text-xs font-medium"
        >
          <Square className="h-3.5 w-3.5" /> ရပ်
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-black/60 px-3 py-2">
      <MediaButton
        icon={Music}
        label="နောက်ခံသီချင်း"
        disabled={busy}
        onClick={() => pick("audio/*", (f) => shareAudio(f, "music"))}
      />
      <MediaButton
        icon={Volume2}
        label="Audio"
        disabled={busy}
        onClick={() => pick("audio/*", (f) => shareAudio(f, "audio"))}
      />
      <MediaButton
        icon={Film}
        label="Video"
        disabled={busy}
        onClick={() => pick("video/*", shareVideo)}
      />
      <MediaButton
        icon={ImageIcon}
        label="Photo"
        disabled={busy}
        onClick={() => pick("image/*", sharePhoto)}
      />
    </div>
  );
}

function MediaButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
