"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { GatewayRecommendation } from "@/components/cctv/vendor/gateway-recommendation";
import { CameraPlayer } from "@/components/cctv/camera-player";
import { HlsPlayer } from "@/components/cctv/hls-player";
import { Button } from "@/components/ui/button";
import type { CameraPlaybackSession } from "@/lib/cctv/playback";

/**
 * Player for a vendor-cloud camera (§14.4-14.5). Requests a fresh
 * short-lived session on mount, dispatches to the matching player, renews
 * shortly before expiry, and retries transient failures with bounded
 * exponential backoff. Authorization failures stop the loop and ask for a
 * relink instead of hammering the vendor.
 */
export function VendorCameraPlayer({
  cameraId,
  title,
  provider,
}: {
  cameraId: string;
  title: string;
  provider: string | null;
}) {
  const t = useTranslations("cctv");
  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "session"; session: CameraPlaybackSession }
    | { kind: "relink" }
    | { kind: "offline" }
    | { kind: "error" }
  >({ kind: "loading" });
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = React.useRef(0);
  const alive = React.useRef(true);

  const schedule = React.useCallback((ms: number, fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  }, []);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/cctv/cameras/${cameraId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!alive.current) return;
      if (res.status === 409) return setState({ kind: "relink" });
      if (res.status === 503) return setState({ kind: "offline" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { session: CameraPlaybackSession };
      retries.current = 0;
      setState({ kind: "session", session: body.session });

      // Renew 30s before an expiring session dies (never sooner than 5s).
      const expiresAt =
        "expiresAt" in body.session && body.session.expiresAt
          ? new Date(body.session.expiresAt).getTime()
          : null;
      if (expiresAt) {
        schedule(Math.max(expiresAt - Date.now() - 30_000, 5_000), () => {
          void load();
        });
      }
    } catch {
      if (!alive.current) return;
      // Bounded exponential backoff: 2s, 4s, 8s, then give up to a manual
      // retry — a dead vendor must not absorb an infinite request stream.
      if (retries.current < 3) {
        const delay = 2 ** (retries.current + 1) * 1000;
        retries.current += 1;
        schedule(delay, () => {
          void load();
        });
      } else {
        setState({ kind: "error" });
      }
    }
  }, [cameraId, schedule]);

  React.useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted/40 text-sm text-muted-foreground">
        {t("vendorLoading")}
      </div>
    );
  }
  if (state.kind === "relink") {
    return (
      <div className="space-y-2 rounded-xl border p-4 text-sm">
        <p>{t("vendorExpiredHint")}</p>
        {provider ? (
          <Button asChild size="sm">
            <a href={`/api/cctv/vendors/${provider}/connect`}>{t("vendorReconnect")}</a>
          </Button>
        ) : null}
      </div>
    );
  }
  if (state.kind === "offline") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted/40 text-sm text-muted-foreground">
        {t("vendorCameraOffline")}
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-2 rounded-xl border p-4 text-sm">
        <p className="text-destructive">{t("vendorError")}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            retries.current = 0;
            setState({ kind: "loading" });
            void load();
          }}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> {t("vendorRetry")}
        </Button>
      </div>
    );
  }

  const { session } = state;
  switch (session.kind) {
    case "hls":
      return <HlsPlayer src={session.url} title={title} />;
    case "embedded_media":
      return <CameraPlayer streamId={session.streamId} title={title} />;
    case "vendor_webrtc":
      // No approved provider returns WebRTC yet; a provider-specific adapter
      // lands with that provider (spec §12 strategy B).
      return (
        <div className="flex aspect-video items-center justify-center rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          {t("vendorWebrtcUnsupported")}
        </div>
      );
    case "unavailable":
      return (
        <div className="space-y-2">
          {session.gatewayRecommended ? (
            <GatewayRecommendation />
          ) : (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              {t("vendorLiveUnavailable")}
            </p>
          )}
        </div>
      );
    case "kvs":
      // Unreachable for vendor cameras; keep the switch exhaustive.
      return null;
  }
}
