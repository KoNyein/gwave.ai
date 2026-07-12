"use client";

import * as React from "react";
import { Camera, Check, RefreshCw, ScanFace, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * KYC face-scan capture. Opens the front camera, lets the member take a selfie
 * and hands the resulting JPEG File back via onCapture. Used in G-Pay
 * registration: a face scan is required before the account can be submitted.
 *
 * The stream is always stopped when the component unmounts or after a capture,
 * so the camera indicator never stays on longer than needed.
 */
export function FaceCapture({
  onCapture,
  hasExisting,
}: {
  onCapture: (file: File | null) => void;
  hasExisting: boolean;
}) {
  const t = useTranslations("gpay");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [live, setLive] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);

  const stopStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  // Always release the camera when this component goes away.
  React.useEffect(() => () => stopStream(), [stopStream]);

  // Revoke the object URL of a replaced preview to avoid a memory leak.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function start() {
    setError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setLive(true);
    } catch {
      setError(t("faceCameraError"));
    } finally {
      setStarting(false);
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const size = Math.min(
      video.videoWidth || 480,
      video.videoHeight || 480,
    );
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Centre-crop to a square so the stored selfie is consistent.
    const sx = ((video.videoWidth || size) - size) / 2;
    const sy = ((video.videoHeight || size) - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(t("faceUploadFailed"));
          return;
        }
        const file = new File([blob], "face.jpg", { type: "image/jpeg" });
        setPreview(URL.createObjectURL(blob));
        onCapture(file);
        stopStream();
      },
      "image/jpeg",
      0.85,
    );
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onCapture(null);
    void start();
  }

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <ScanFace className="h-4 w-4 text-primary" /> {t("faceTitle")}
        <span className="text-destructive"> *</span>
      </p>
      <p className="text-xs text-muted-foreground">{t("faceHint")}</p>

      <div className="relative mx-auto aspect-square w-44 overflow-hidden rounded-full border-2 border-dashed bg-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="face scan"
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)", display: live ? "block" : "none" }}
          />
        )}
        {!live && !preview ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <Camera className="h-8 w-8" />
            {hasExisting ? (
              <span className="flex items-center gap-1 text-[11px] text-primary">
                <Check className="h-3.5 w-3.5" /> {t("faceOnFile")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {preview ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Check className="h-3.5 w-3.5" /> {t("faceCaptured")}
            </span>
            <button
              type="button"
              onClick={retake}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {t("faceRetake")}
            </button>
          </>
        ) : live ? (
          <>
            <button
              type="button"
              onClick={capture}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Camera className="h-3.5 w-3.5" /> {t("faceCapture")}
            </button>
            <button
              type="button"
              onClick={stopStream}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="inline-flex items-center gap-1 rounded-full border px-4 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            <ScanFace className="h-3.5 w-3.5" />
            {hasExisting ? t("faceReplace") : t("faceStart")}
          </button>
        )}
      </div>

      {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
