"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/// 📷 getUserMedia hook (spec §3) — front camera preview stream။
///
/// ★ iOS Safari — user gesture + HTTPS မှ ရတယ် (spec §13)၊ ဒါကြောင့်
///   start() ကို ခလုတ်နှိပ်မှ ခေါ်တယ်၊ auto-start မလုပ်ဘူး။
/// ★ Cleanup — track တွေ မရပ်ရင် ကင်မရာမီး လင်းနေပြီး battery ကုန်တယ်။

export type CameraState = "idle" | "starting" | "on" | "denied" | "unsupported";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return false;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
      setState("on");
      return true;
    } catch {
      setState("denied");
      return false;
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { videoRef, state, start, stop };
}
