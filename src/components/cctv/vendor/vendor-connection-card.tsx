"use client";

import * as React from "react";
import Link from "next/link";
import { Cloud, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export interface VendorConnectionInfo {
  id: string;
  provider: string;
  account_label: string | null;
  status: string;
  connected_at: string;
}

/**
 * One linked vendor account: label, status, an import link and disconnect.
 * Disconnect asks for confirmation — it kills the stored tokens for every
 * camera imported from this account.
 */
export function VendorConnectionCard({
  connection,
  providerLabel,
  onDisconnected,
}: {
  connection: VendorConnectionInfo;
  providerLabel: string;
  onDisconnected?: () => void;
}) {
  const t = useTranslations("cctv");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const disconnect = async () => {
    if (!window.confirm(t("vendorDisconnectConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cctv/vendors/${connection.provider}/disconnect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: connection.id }),
        },
      );
      if (!res.ok) throw new Error();
      onDisconnected?.();
    } catch {
      setError(t("vendorError"));
    } finally {
      setBusy(false);
    }
  };

  const connected = connection.status === "connected";
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
      <Cloud className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {providerLabel}
          {connection.account_label ? (
            <span className="text-muted-foreground"> · {connection.account_label}</span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {connected ? t("vendorStatusConnected") : t("vendorStatusExpired")}
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      {connected ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/cameras/vendors/${connection.provider}`}>
            {t("vendorImportCameras")}
          </Link>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <a href={`/api/cctv/vendors/${connection.provider}/connect`}>
            {t("vendorReconnect")}
          </a>
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={disconnect}
        disabled={busy}
        aria-label={t("vendorDisconnect")}
      >
        <Unplug className="h-4 w-4" />
      </Button>
    </div>
  );
}
