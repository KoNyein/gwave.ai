"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, CircleOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { GatewayRecommendation } from "@/components/cctv/vendor/gateway-recommendation";
import { VendorCapabilities } from "@/components/cctv/vendor/vendor-capabilities";
import { Button } from "@/components/ui/button";
import type { CameraVendorCapabilities } from "@/types/database";

interface CandidateRow {
  vendorCameraId: string;
  name: string;
  model?: string;
  serialNumberMasked?: string;
  online: boolean | null;
  capabilities: CameraVendorCapabilities;
  alreadyImported: boolean;
}

interface CamerasResponse {
  connection: { id: string; label: string | null };
  cameras: CandidateRow[];
}

/**
 * The import page body: discovered cameras with capabilities, selection
 * checkboxes, and the import action. Cameras whose cloud cannot serve live
 * video still import (snapshots/events may work) but carry the gateway
 * recommendation so the limitation is visible BEFORE importing.
 */
export function VendorCameraImport({ provider }: { provider: string }) {
  const t = useTranslations("cctv");
  const router = useRouter();
  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "relink" }
    | { kind: "error"; code: string }
    | { kind: "ready"; data: CamerasResponse }
  >({ kind: "loading" });
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [doneCount, setDoneCount] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/cctv/vendors/${provider}/cameras`);
      if (res.status === 409) return setState({ kind: "relink" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return setState({ kind: "error", code: body?.error ?? "network" });
      }
      setState({ kind: "ready", data: (await res.json()) as CamerasResponse });
    } catch {
      setState({ kind: "error", code: "network" });
    }
  }, [provider]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importSelected = async () => {
    if (state.kind !== "ready" || selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cctv/vendors/${provider}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: state.data.connection.id,
          cameraIds: [...selected],
        }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as {
        results: Array<{ id: string | null }>;
      };
      setDoneCount(body.results.filter((r) => r.id).length);
      setSelected(new Set());
      router.refresh();
      void load();
    } catch {
      setState({ kind: "error", code: "network" });
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{t("vendorLoading")}</p>;
  }
  if (state.kind === "relink") {
    return (
      <div className="space-y-2 text-sm">
        <p>{t("vendorExpiredHint")}</p>
        <Button asChild size="sm">
          <a href={`/api/cctv/vendors/${provider}/connect`}>{t("vendorReconnect")}</a>
        </Button>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-destructive">
          {state.code === "rate_limited" ? t("vendorRateLimited") : t("vendorError")}
        </p>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> {t("vendorRetry")}
        </Button>
      </div>
    );
  }

  const { cameras } = state.data;
  return (
    <div className="space-y-3">
      {doneCount !== null ? (
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          {t("vendorImported", { count: doneCount })}
        </p>
      ) : null}

      {cameras.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("vendorNoCameras")}</p>
      ) : (
        <ul className="space-y-2">
          {cameras.map((cam) => (
            <li key={cam.vendorCameraId} className="rounded-lg border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(cam.vendorCameraId)}
                  disabled={cam.alreadyImported}
                  onChange={() => toggle(cam.vendorCameraId)}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Camera className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{cam.name}</span>
                    {cam.online === false ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CircleOff className="h-3 w-3" /> {t("vendorOffline")}
                      </span>
                    ) : null}
                    {cam.alreadyImported ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {t("vendorAlreadyImported")}
                      </span>
                    ) : null}
                  </p>
                  {cam.model || cam.serialNumberMasked ? (
                    <p className="text-xs text-muted-foreground">
                      {[cam.model, cam.serialNumberMasked].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  <VendorCapabilities capabilities={cam.capabilities} />
                  {!cam.capabilities.liveView ? <GatewayRecommendation /> : null}
                </div>
              </label>
            </li>
          ))}
        </ul>
      )}

      {cameras.some((c) => !c.alreadyImported) ? (
        <Button onClick={importSelected} disabled={busy || selected.size === 0}>
          {t("vendorImportSelected", { count: selected.size })}
        </Button>
      ) : null}
    </div>
  );
}
