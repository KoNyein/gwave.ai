"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Globe, Loader2, Lock, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  deleteCamera,
  regenerateShareToken,
  setCameraVisibility,
} from "@/lib/actions/cctv";

const DURATIONS = [
  { key: "indefinite", minutes: 0 },
  { key: "1h", minutes: 60 },
  { key: "24h", minutes: 24 * 60 },
] as const;

/** Owner controls for one camera: public/private toggle with optional expiry,
 *  the share link, token rotation and deletion. */
export function CameraShareControls({
  id,
  isPublic,
  publicUntil,
  shareToken: initialToken,
  baseUrl,
}: {
  id: string;
  isPublic: boolean;
  publicUntil: string | null;
  shareToken: string;
  baseUrl: string;
}) {
  const t = useTranslations("cctv");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [duration, setDuration] = React.useState<number>(0);
  const [shareToken, setShareToken] = React.useState(initialToken);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const shareLink = `${baseUrl}/watch/${shareToken}`;

  async function toggleVisibility(next: boolean) {
    setPending(true);
    setError(null);
    const res = await setCameraVisibility({
      id,
      isPublic: next,
      durationMinutes: next ? duration : 0,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function rotate() {
    setPending(true);
    setError(null);
    const res = await regenerateShareToken({ id });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShareToken(res.data.shareToken);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setPending(true);
    const res = await deleteCamera({ id });
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    router.push("/cameras");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t("copyFailed"));
    }
  }

  const expired = publicUntil ? new Date(publicUntil).getTime() < Date.now() : false;
  const live = isPublic && !expired;

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        {live ? (
          <Globe className="h-4 w-4 text-primary" />
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-semibold">
          {live ? t("statusPublic") : t("statusPrivate")}
        </span>
        {live && publicUntil ? (
          <span className="text-xs text-muted-foreground">
            {t("until", {
              time: new Date(publicUntil).toLocaleString(),
            })}
          </span>
        ) : null}
      </div>

      {!live ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("makePublicHint")}</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDuration(d.minutes)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  duration === d.minutes
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                {t(`duration_${d.key}`)}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => toggleVisibility(true)} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-1 h-4 w-4" />
            )}
            {t("makePublic")}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => toggleVisibility(false)}
          disabled={pending}
        >
          <Lock className="mr-1 h-4 w-4" /> {t("makePrivate")}
        </Button>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium">{t("shareLink")}</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={shareLink}
            className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {live ? t("linkPublicHint") : t("linkPrivateHint")}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button size="sm" variant="ghost" onClick={rotate} disabled={pending}>
          <RefreshCw className="mr-1 h-4 w-4" /> {t("rotateToken")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={remove}
          disabled={pending}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1 h-4 w-4" /> {t("deleteCamera")}
        </Button>
      </div>
    </div>
  );
}
