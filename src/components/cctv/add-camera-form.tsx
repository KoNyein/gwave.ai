"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Video } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCamera } from "@/lib/actions/cctv";

/**
 * RTSP URL templates for common CCTV brands. GreenWave plays any camera that
 * speaks RTSP (the universal IP-camera standard), so this list is just a
 * convenience: pick a brand and the correct path is filled in — replace
 * USER / PASS / the IP with your camera's own values.
 */
const RTSP_PRESETS: ReadonlyArray<{
  label: string;
  template: string;
  note: string;
}> = [
  {
    label: "Tapo / TP-Link",
    template: "rtsp://USER:PASS@192.168.1.100:554/stream1",
    note: "Tapo app → Advanced Settings → Camera Account မှာ USER/PASS ဆောက်ပါ (cloud email မဟုတ်)။ HD=/stream1, SD=/stream2",
  },
  {
    label: "Hikvision",
    template: "rtsp://USER:PASS@192.168.1.100:554/Streaming/Channels/101",
    note: "101 = main stream, 102 = sub stream",
  },
  {
    label: "Dahua",
    template:
      "rtsp://USER:PASS@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0",
    note: "subtype=0 main, subtype=1 sub",
  },
  {
    label: "Reolink",
    template: "rtsp://USER:PASS@192.168.1.100:554/h264Preview_01_main",
    note: "_main = HD, _sub = SD",
  },
  {
    label: "Amcrest",
    template:
      "rtsp://USER:PASS@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0",
    note: "Dahua-based format",
  },
  {
    label: "ONVIF / Generic",
    template: "rtsp://USER:PASS@192.168.1.100:554/onvif1",
    note: "brand အလိုက် path ကွဲတယ် — camera doc/ONVIF Device Manager ကြည့်ပါ",
  },
];

/** Register a new camera — a phone/PC (WebRTC) or a real CCTV (RTSP). */
export function AddCameraForm() {
  const t = useTranslations("cctv");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [cameraType, setCameraType] = React.useState<"webrtc" | "rtsp" | "kvs">(
    "webrtc",
  );
  const [rtspUrl, setRtspUrl] = React.useState("");
  const [kvsChannel, setKvsChannel] = React.useState("");
  const [kvsRegion, setKvsRegion] = React.useState("");
  const [zone, setZone] = React.useState("");
  const [ptzUrl, setPtzUrl] = React.useState("");
  const [presetNote, setPresetNote] = React.useState<string | null>(null);
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
      kvsChannel: cameraType === "kvs" ? kvsChannel.trim() : undefined,
      kvsRegion: cameraType === "kvs" ? kvsRegion.trim() : undefined,
      zone: zone.trim() || undefined,
      ptzUrl: ptzUrl.trim() || undefined,
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
        <div className="grid grid-cols-3 gap-2">
          {(["webrtc", "rtsp", "kvs"] as const).map((type) => (
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
          {/* Works with any RTSP camera — these presets just fill the correct
              path for common brands; replace USER / PASS / IP with yours. */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {RTSP_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setRtspUrl(p.template);
                  setPresetNote(p.note);
                }}
                className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
              >
                {p.label}
              </button>
            ))}
          </div>
          <Input
            id="cam-rtsp"
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
            placeholder="rtsp://USER:PASS@192.168.1.100:554/stream1"
            maxLength={500}
          />
          {presetNote ? (
            <p className="text-xs text-primary">{presetNote}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("rtspHint")}</p>
        </div>
      ) : null}

      {cameraType === "kvs" ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="cam-kvs-channel">{t("kvsChannelLabel")}</Label>
            <Input
              id="cam-kvs-channel"
              value={kvsChannel}
              onChange={(e) => setKvsChannel(e.target.value)}
              placeholder="Hydroponics-Cam"
              maxLength={256}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cam-kvs-region">{t("kvsRegionLabel")}</Label>
            <Input
              id="cam-kvs-region"
              value={kvsRegion}
              onChange={(e) => setKvsRegion(e.target.value)}
              placeholder="ap-southeast-1"
              maxLength={40}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("kvsHint")}</p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cam-zone">{t("zoneLabel")}</Label>
          <Input
            id="cam-zone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder={t("zonePlaceholder")}
            maxLength={60}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cam-ptz">{t("ptzLabel")}</Label>
          <Input
            id="cam-ptz"
            value={ptzUrl}
            onChange={(e) => setPtzUrl(e.target.value)}
            placeholder="https://…/ptz?move={move}"
            maxLength={500}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("ptzHint")}</p>

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
