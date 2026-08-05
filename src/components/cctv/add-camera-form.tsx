"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Video } from "lucide-react";
import { useTranslations } from "next-intl";

import { VendorProviderList } from "@/components/cctv/vendor/vendor-provider-list";
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

  // ── 🎥 Tapo guided wizard ────────────────────────────────────────────────
  // Template ထဲက USER/PASS/IP ကို လက်နဲ့ အစားထိုးရတာ အမှားအများဆုံး
  // အဆင့်မို့ Tapo အတွက်တော့ ကွက်လပ် ၃ ခု ဖြည့်ရုံနဲ့ URL ကို ကျွန်တော်တို့
  // ဘက်က ဆောက်ပေးတယ်။ တခြား brand တွေက template chip အတိုင်း။
  const [tapoMode, setTapoMode] = React.useState(false);
  const [tapoIp, setTapoIp] = React.useState("");
  const [tapoUser, setTapoUser] = React.useState("");
  const [tapoPass, setTapoPass] = React.useState("");
  const [tapoHd, setTapoHd] = React.useState(true);
  React.useEffect(() => {
    if (!tapoMode) return;
    const ip = tapoIp.trim();
    const u = tapoUser.trim();
    const p = tapoPass;
    if (ip && u && p) {
      setRtspUrl(
        `rtsp://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${ip}:554/${tapoHd ? "stream1" : "stream2"}`,
      );
    }
  }, [tapoMode, tapoIp, tapoUser, tapoPass, tapoHd]);

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
                  if (p.label.startsWith("Tapo")) {
                    // Tapo — guided wizard (template မဟုတ်)
                    setTapoMode(true);
                    setPresetNote(null);
                    return;
                  }
                  setTapoMode(false);
                  setRtspUrl(p.template);
                  setPresetNote(p.note);
                }}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60 ${
                  p.label.startsWith("Tapo") && tapoMode
                    ? "border-primary bg-primary/10"
                    : ""
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {tapoMode ? (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-medium">
                🎥 Tapo ကင်မရာ — အဆင့် ၃ ဆင့်တည်း
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                <li>
                  Tapo app → ကင်မရာရွေး → ⚙️ → <b>Advanced Settings</b> →{" "}
                  <b>Camera Account</b> မှာ account အသစ်ဆောက်ပါ (Tapo cloud
                  email <b>မဟုတ်ပါ</b> — ကင်မရာသီးသန့် အကောင့်ပါ)
                </li>
                <li>
                  ကင်မရာရဲ့ IP ကို Tapo app → ⚙️ → Device Info မှာ ကြည့်ပါ
                  (router မှာ DHCP reservation လုပ်ထားရင် IP မပြောင်းတော့ပါ)
                </li>
                <li>အောက်က ကွက်လပ် ၃ ခု ဖြည့်ပါ — link ကို အလိုအလျောက် ဆောက်ပေးပါမယ်</li>
              </ol>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={tapoIp}
                  onChange={(e) => setTapoIp(e.target.value)}
                  placeholder="IP (192.168.1.xx)"
                  maxLength={45}
                  aria-label="Tapo camera IP"
                />
                <Input
                  value={tapoUser}
                  onChange={(e) => setTapoUser(e.target.value)}
                  placeholder="Camera Account user"
                  maxLength={60}
                  aria-label="Tapo camera account user"
                />
                <Input
                  type="password"
                  value={tapoPass}
                  onChange={(e) => setTapoPass(e.target.value)}
                  placeholder="Password"
                  maxLength={60}
                  aria-label="Tapo camera account password"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={tapoHd}
                  onChange={(e) => setTapoHd(e.target.checked)}
                />
                HD (stream1) — ဖြုတ်ရင် SD (stream2, data သက်သာ)
              </label>
              <p className="text-[11px] text-muted-foreground">
                ⚠️ ကင်မရာက ဒီ server နဲ့ network တစ်ခုတည်း (သို့) VPN/port
                forward နဲ့ ရောက်နိုင်ရပါမယ်။ Link က အောက်က RTSP ကွက်ထဲ
                အလိုအလျောက် ဝင်သွားပါမယ်။
              </p>
            </div>
          ) : null}
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

      {/* Approved vendor-cloud accounts (Hik-Connect etc.). Self-hiding:
          renders nothing while the cctv_vendor_cloud flag is off or no
          provider is configured. */}
      <VendorProviderList />
    </form>
  );
}
