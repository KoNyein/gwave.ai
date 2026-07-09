"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MonitorPlay } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { setCameraHlsUrl } from "@/lib/actions/cctv";

/**
 * Owner-only form to set the camera's public HLS (.m3u8) playback URL — the
 * credential-free stream the operator's media server publishes. The private
 * RTSP source is never entered or shown here.
 */
export function CameraHlsForm({
  id,
  hlsUrl,
}: {
  id: string;
  hlsUrl: string | null;
}) {
  const t = useTranslations("cctv");
  const router = useRouter();
  const [value, setValue] = React.useState(hlsUrl ?? "");
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await setCameraHlsUrl({ id, hlsUrl: value.trim() });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-2 rounded-xl border p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <MonitorPlay className="h-4 w-4 text-primary" /> {t("hlsTitle")}
      </p>
      <p className="text-xs text-muted-foreground">{t("hlsHint")}</p>
      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://media.example.com/cam/index.m3u8"
          className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 font-mono text-xs"
        />
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            t("save")
          )}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">{t("hlsSecurityNote")}</p>
    </form>
  );
}
