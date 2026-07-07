import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function DevLogsPage() {
  const t = await getTranslations("dev");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, prefix")
    .eq("owner_id", profile.id);
  const keyNames = new Map((keys ?? []).map((key) => [key.id, key.name]));

  const { data: logs } = await supabase
    .from("api_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  // Per-endpoint counts for a simple bar list.
  const byEndpoint = new Map<string, number>();
  for (const log of logs ?? []) {
    byEndpoint.set(log.endpoint, (byEndpoint.get(log.endpoint) ?? 0) + 1);
  }
  const endpointStats = [...byEndpoint.entries()].sort(([, a], [, b]) => b - a);
  const maxCount = endpointStats[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("logsTitle")}</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("requestsByEndpoint")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {endpointStats.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noLogs")}
            </p>
          ) : (
            endpointStats.map(([endpoint, count]) => (
              <div key={endpoint}>
                <div className="mb-0.5 flex justify-between text-sm">
                  <span className="font-mono text-xs">{endpoint}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("recentRequests")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y px-4 py-1">
          {(logs ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noLogs")}
            </p>
          ) : (
            (logs ?? []).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span
                    className={cn(
                      "mr-2 rounded px-1.5 py-0.5 font-mono text-xs font-semibold",
                      log.status < 400
                        ? "bg-secondary text-primary"
                        : "bg-red-100 text-red-700",
                    )}
                  >
                    {log.status}
                  </span>
                  <span className="font-mono text-xs">
                    {log.method} {log.endpoint}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {keyNames.get(log.api_key_id) ?? "?"} ·{" "}
                  {log.latency_ms !== null ? `${log.latency_ms} ms · ` : ""}
                  {timeAgo(log.created_at)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
