"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/// 📷 getUserMedia hook (spec §3) — camera preview stream, front OR back။
///
/// ★ iOS Safari — user gesture + HTTPS မှ ရတယ် (spec §13)၊ ဒါကြောင့်
///   start() ကို ခလုတ်နှိပ်မှ ခေါ်တယ်၊ auto-start မလုပ်ဘူး။
/// ★ Cleanup — track တွေ မရပ်ရင် ကင်မရာမီး လင်းနေပြီး battery ကုန်တယ်။
/// ★ flip() — front ↔ back။ Body scan ကို တခြားသူက back camera နဲ့
///   ရိုက်ပေးရင် အရည်အသွေး ပိုကောင်းတယ်။ facingMode က ideal request ပဲ —
///   ကင်မရာတစ်လုံးတည်းရှိတဲ့ စက်မှာ ရှိတာနဲ့ ဆက်သွားတယ်။
/// ★ Torch — back camera မှာ device က ထောက်ပံ့ရင် 🔦 ဖွင့်/ပိတ်လို့ရ
///   (Android Chrome/WebView) — အလင်းနည်းတဲ့ နေရာ scan အတွက်။

export type CameraState = "idle" | "starting" | "on" | "denied" | "unsupported";
export type CameraFacing = "user" | "environment";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<CameraFacing>("user");
  const [state, setState] = useState<CameraState>("idle");
  const [facing, setFacing] = useState<CameraFacing>("user");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const start = useCallback(async (want?: CameraFacing) => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("unsupported");
      return false;
    }
    const face = want ?? facingRef.current;
    facingRef.current = face;
    setFacing(face);
    // restart cleanly — two live streams fight over the camera
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTorchSupported(false);
    setTorchOn(false);
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: face,
          // 1080p ideal — scan texture ကြည်ဖို့။ မတတ်နိုင်တဲ့စက်က သူ့အမြင့်ဆုံးနဲ့
          // fallback ဆင်းတယ် (ideal constraint မို့ ဘယ်တော့မှ fail မဖြစ်)။
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        await v.play().catch(() => undefined);
      }
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean })
        | undefined;
      setTorchSupported(Boolean(caps?.torch));
      setState("on");
      return true;
    } catch {
      setState("denied");
      return false;
    }
  }, []);

  /// Front ↔ back. Returns whether the new camera actually started.
  const flip = useCallback(() => {
    const next: CameraFacing =
      facingRef.current === "user" ? "environment" : "user";
    return start(next);
  }, [start]);

  const setTorch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
      setTorchOn(on);
    } catch {
      // capability probe said yes but the device refused — leave state as-is
    }
  }, []);

  useEffect(() => stop, [stop]);

  return {
    videoRef,
    state,
    facing,
    start,
    stop,
    flip,
    torchSupported,
    torchOn,
    setTorch,
  };
}
