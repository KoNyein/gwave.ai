"use client";

import * as React from "react";
import { Cloud } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  VendorConnectionCard,
  type VendorConnectionInfo,
} from "@/components/cctv/vendor/vendor-connection-card";

interface ProvidersResponse {
  providers: Array<{ id: string; label: string }>;
  connections: VendorConnectionInfo[];
}

/**
 * "Connect vendor account" section: enabled providers as connect buttons,
 * plus the user's existing links. Self-hiding — with the feature flag off
 * (or no provider configured) the API returns an empty list and this
 * renders nothing, so the add-camera form stays exactly as before.
 */
export function VendorProviderList() {
  const t = useTranslations("cctv");
  const [data, setData] = React.useState<ProvidersResponse | null>(null);

  const load = React.useCallback(() => {
    fetch("/api/cctv/vendors")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: ProvidersResponse | null) => setData(json))
      .catch(() => setData(null));
  }, []);
  React.useEffect(load, [load]);

  if (!data || data.providers.length === 0) return null;
  const labelOf = (provider: string) =>
    data.providers.find((p) => p.id === provider)?.label ?? provider;
  // Disconnected links stay in history server-side but are noise here.
  const visible = data.connections.filter((c) => c.status !== "disconnected");

  return (
    <div className="space-y-2 rounded-xl border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Cloud className="h-4 w-4 text-primary" /> {t("vendorConnectTitle")}
      </p>
      <p className="text-xs text-muted-foreground">{t("vendorConnectHint")}</p>
      {visible.map((c) => (
        <VendorConnectionCard
          key={c.id}
          connection={c}
          providerLabel={labelOf(c.provider)}
          onDisconnected={load}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {data.providers.map((p) => (
          <a
            key={p.id}
            href={`/api/cctv/vendors/${p.id}/connect`}
            className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            {t("vendorConnectAction", { provider: p.label })}
          </a>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("vendorMoreSoon")}</p>
    </div>
  );
}
