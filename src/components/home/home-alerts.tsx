"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BellRing, Check, Info, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { acknowledgeAlert } from "@/lib/actions/iot";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/data/client";
import { cn } from "@/lib/utils";
import type { AlertWithDevice } from "@/lib/db/iot";
import type { AlertSeverity } from "@/types/database";

const SEVERITY: Record<
  AlertSeverity,
  { icon: React.ReactNode; cls: string; label: string }
> = {
  info: { icon: <Info className="h-4 w-4" />, cls: "text-blue-600 bg-blue-500/10", label: "အချက်အလက်" },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    cls: "text-amber-600 bg-amber-500/10",
    label: "သတိပေး",
  },
  critical: {
    icon: <ShieldAlert className="h-4 w-4" />,
    cls: "text-destructive bg-destructive/10",
    label: "အရေးပေါ်",
  },
};

export function HomeAlerts({
  initialAlerts,
  userId,
}: {
  initialAlerts: AlertWithDevice[];
  userId: string;
}) {
  const router = useRouter();
  const [alerts, setAlerts] = React.useState(initialAlerts);
  const [busy, setBusy] = React.useState<string | null>(null);

  // New alerts stream in over realtime (RLS-scoped to this owner).
  React.useEffect(() => {
    const db = createClient();
    const channel = db
      .channel(`home-alerts:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `owner_id=eq.${userId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [userId, router]);

  React.useEffect(() => setAlerts(initialAlerts), [initialAlerts]);

  const unack = alerts.filter((a) => !a.acknowledged);

  async function ack(id: string) {
    setBusy(id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    );
    await acknowledgeAlert(id);
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <BellRing className="h-4 w-4 text-primary" /> သတိပေးမှုများ
          </p>
          {unack.length > 0 ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {unack.length} အသစ်
            </span>
          ) : null}
        </div>

        {alerts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            ✅ သတိပေးမှု မရှိပါ — အားလုံး ပုံမှန်ပါ။
          </p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.slice(0, 20).map((a) => {
              const sev = SEVERITY[a.severity];
              return (
                <li
                  key={a.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-2.5",
                    a.acknowledged && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      sev.cls,
                    )}
                  >
                    {sev.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{a.message}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.device?.name ? `${a.device.name} · ` : ""}
                      {sev.label} · {timeAgo(a.created_at)}
                    </p>
                  </div>
                  {!a.acknowledged ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2"
                      disabled={busy === a.id}
                      onClick={() => ack(a.id)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> OK
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
