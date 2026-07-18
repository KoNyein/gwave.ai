"use client";

import * as React from "react";
import { useRoomContext } from "@livekit/components-react";
import { LocalVideoTrack, Track } from "livekit-client";
import {
  AudioLines,
  Film,
  Image as ImageIcon,
  Music,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";

// Host-only "advanced Live" media sharing. On top of the camera/mic, the host
// can push extra tracks into the same LiveKit room:
//   • Background music / audio  → a screen-share audio track (mixed via Web
//     Audio so the host hears it locally too)
//   • Video file                → a screen-share video + audio track
//   • Photo                     → a static canvas captured as a video track
// …plus two overlay *effects* that composite directly onto the live camera
// (the host's own camera feed is replaced with a canvas that draws camera +
// overlay, then restored on "Stop"):
//   • Music FX  → play a song and paint an audio-reactive visualizer over cam
//   • Photo FX  → paint a (transparent) frame / sticker over the camera
// Everything is unpublished / the camera restored and cleaned up on "Stop".

type CaptureEl = HTMLVideoElement & { captureStream?: () => MediaStream };

interface Sharing {
  kind: "music" | "audio" | "video" | "photo" | "music-fx" | "photo-fx";
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

  // ── Overlay effects ─────────────────────────────────────────────────────
  // Composite the host's own camera with an overlay onto a canvas and swap the
  // published camera track for that canvas. The raw camera is restored (via
  // restartTrack) when the effect stops, so viewers keep seeing the host — now
  // with the effect painted on top rather than a separate share tile.
  async function startCameraOverlay(kind: "music-fx" | "photo-fx", file: File) {
    const camTrack = room.localParticipant.getTrackPublication(
      Track.Source.Camera,
    )?.track;
    const raw = camTrack?.mediaStreamTrack;
    if (!(camTrack instanceof LocalVideoTrack) || !raw) {
      throw new Error("camera required");
    }

    // Clone the live camera so the compositor keeps a feed after we replace the
    // published track with the canvas (a clone shares the source and stays live
    // independently).
    const camClone = raw.clone();
    const camVideo = document.createElement("video");
    camVideo.srcObject = new MediaStream([camClone]);
    camVideo.muted = true;
    camVideo.playsInline = true;
    await camVideo.play();

    const settings = raw.getSettings();
    const canvas = document.createElement("canvas");
    canvas.width = settings.width ?? 1280;
    canvas.height = settings.height ?? 720;
    const g = canvas.getContext("2d")!;

    const extraTracks: MediaStreamTrack[] = [];
    const cleanups: Array<() => void> = [];
    let paintOverlay: (w: number, h: number) => void;

    if (kind === "photo-fx") {
      const imgUrl = URL.createObjectURL(file);
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
        img.src = imgUrl;
      });
      cleanups.push(() => URL.revokeObjectURL(imgUrl));
      // Stretch the overlay across the whole frame — a transparent PNG frame
      // shows the camera through its middle; a solid image acts as a sticker.
      paintOverlay = (w, h) => g.drawImage(img, 0, 0, w, h);
    } else {
      // music-fx: play the song (published + audible to the host) and draw an
      // audio-reactive equaliser along the bottom of the camera frame.
      const audioUrl = URL.createObjectURL(file);
      const el = document.createElement("audio");
      el.src = audioUrl;
      el.loop = true;
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      const dest = ctx.createMediaStreamDestination();
      source.connect(analyser);
      source.connect(dest);
      source.connect(ctx.destination); // host hears it too
      await el.play();
      const aTrack = dest.stream.getAudioTracks()[0]!;
      await room.localParticipant.publishTrack(aTrack, {
        source: Track.Source.ScreenShareAudio,
        name: "fx-music",
      });
      extraTracks.push(aTrack);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      cleanups.push(() => {
        el.pause();
        void ctx.close().catch(() => {});
        URL.revokeObjectURL(audioUrl);
      });
      paintOverlay = (w, h) => {
        analyser.getByteFrequencyData(bins);
        const n = bins.length;
        const bw = w / n;
        g.save();
        g.globalAlpha = 0.85;
        for (let i = 0; i < n; i++) {
          const v = bins[i]! / 255;
          const bh = v * h * 0.3;
          g.fillStyle = `hsl(${140 + i * 2}, 90%, 55%)`;
          g.fillRect(i * bw, h - bh, bw * 0.82, bh);
        }
        g.restore();
      };
    }

    let raf = 0;
    const render = () => {
      if (camVideo.readyState >= 2) {
        g.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
      }
      paintOverlay(canvas.width, canvas.height);
      raf = requestAnimationFrame(render);
    };
    render();

    const outTrack = canvas.captureStream(30).getVideoTracks()[0]!;
    await camTrack.replaceTrack(outTrack);

    setSharing({
      kind,
      // Only extra (audio) tracks are unpublished on stop; the camera is
      // restored via restartTrack in cleanup, not unpublished.
      tracks: extraTracks,
      cleanup: () => {
        cancelAnimationFrame(raf);
        camVideo.pause();
        camClone.stop();
        outTrack.stop();
        cleanups.forEach((c) => c());
        void camTrack.restartTrack().catch(() => {});
      },
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
            : sharing.kind === "music-fx"
              ? "🎶 သီချင်း Effect ဖွင့်နေသည်"
              : sharing.kind === "photo-fx"
                ? "✨ ဓာတ်ပုံ Effect ဖွင့်နေသည်"
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
      <MediaButton
        icon={AudioLines}
        label="သီချင်း Effect"
        disabled={busy}
        onClick={() => pick("audio/*", (f) => startCameraOverlay("music-fx", f))}
      />
      <MediaButton
        icon={Sparkles}
        label="ဓာတ်ပုံ Effect"
        disabled={busy}
        onClick={() => pick("image/*", (f) => startCameraOverlay("photo-fx", f))}
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
