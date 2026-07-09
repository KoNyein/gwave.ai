"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Video } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCamera } from "@/lib/actions/cctv";

/** Register a new camera — a phone/PC (WebRTC) or a real CCTV (RTSP). */
export function AddCameraForm() {
  const t = useTranslations("cctv");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [cameraType, setCameraType] = React.useState<"webrtc" | "rtsp">("webrtc");
  const [rtspUrl, setRtspUrl] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await createCamera({
      title: title.trim() || t("defaultTitle"),
      cameraType,
      rtspUrl: cameraType === "rtsp" ? rtspUrl.trim() : undefined,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTitle("");
    setRtspUrl("");
    setOpen(false);
    router.push(`/cameras/${res.data.id}`);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="mr-1 h-4 w-4" /> {t("addCamera")}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Video className="h-4 w-4 text-primary" /> {t("addCamera")}
      </p>

      <div className="space-y-1">
        <Label htmlFor="cam-title">{t("titleLabel")}</Label>
        <Input
          id="cam-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          maxLength={120}
        />
      </div>

      <div className="space-y-1">
        <Label>{t("typeLabel")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["webrtc", "rtsp"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCameraType(type)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                cameraType === type
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">{t(`type_${type}`)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t(`type_${type}_hint`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {cameraType === "rtsp" ? (
        <div className="space-y-1">
          <Label htmlFor="cam-rtsp">{t("rtspLabel")}</Label>
          <Input
            id="cam-rtsp"
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
            placeholder="rtsp://192.168.1.10:554/stream"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">{t("rtspHint")}</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          {t("create")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
