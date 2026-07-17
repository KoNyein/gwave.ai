"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Loader2, Plus, RefreshCw, Unplug } from "lucide-react";

import {
  connectHealthProvider,
  disconnectHealthDevice,
  syncHealth,
} from "@/lib/actions/health";
import type { HealthConnection } from "@/lib/db/health";

/**
 * Connect / manage the Fitbit link. "Connect Fitbit" opens Fitbit's OAuth page;
 * once connected the device is listed with Sync + Disconnect actions.
 */
export function ConnectPanel({
  connections,
  enabled,
}: {
  connections: HealthConnection[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    const res = await connectHealthProvider();
    if (res.ok) {
      window.location.href = res.data.url;
      return;
    }
    setError(res.error);
    setBusy(false);
  }

  async function sync() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await syncHealth();
    setBusy(false);
    if (res.ok) {
      setNote("Sync ပြီးပါပြီ။");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function disconnect(id: string) {
    setBusy(true);
    await disconnectHealthDevice(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">ချိတ်ဆက်ထားသော စက်များ</h2>
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Fitbit မချိတ်ရသေးပါ — အောက်က ခလုတ်နဲ့ ချိတ်ပါ။
        </p>
      ) : (
        <ul className="space-y-2">
          {connections.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
            >
              <div className="text-sm">
                <p className="font-medium capitalize">{c.provider}</p>
                <p className="text-xs text-muted-foreground">
                  {c.status === "connected" ? "ချိတ်ဆက်ထား" : c.status}
                  {c.last_sync_at
                    ? ` · sync ${new Date(c.last_sync_at).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={sync}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Sync
                </button>
                <button
                  type="button"
                  onClick={() => disconnect(c.id)}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Unplug className="h-3.5 w-3.5" /> ဖြုတ်
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {note ? <p className="text-sm text-primary">{note}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {connections.length === 0 ? (
        <button
          type="button"
          onClick={connect}
          disabled={busy || !enabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Fitbit နဲ့ ချိတ်ဆက်ရန်
        </button>
      ) : null}

      {!enabled ? (
        <p className="text-center text-xs text-muted-foreground">
          Health sync ကို server မှာ ဖွင့်ရန် ကျန်ပါသေးသည်။
        </p>
      ) : null}
    </div>
  );
}
