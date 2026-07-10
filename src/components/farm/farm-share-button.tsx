"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Share2 } from "lucide-react";

import { formatMetric, metricLabel, metricUnit } from "@/components/farm/metrics";
import { Button } from "@/components/ui/button";
import { createPost } from "@/lib/actions/posts";
import type { Device } from "@/types/database";

/**
 * Shares a snapshot of the farm's current sensor readings as a public feed
 * post — "my farm status right now", one tap.
 */
export function FarmShareButton({
  sensors,
  latest,
}: {
  sensors: Device[];
  latest: Record<string, { value: number; ts: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function buildSummary(): string {
    const lines: string[] = [];
    for (const sensor of sensors) {
      const parts: string[] = [];
      for (const key of Object.keys(latest)) {
        if (!key.startsWith(`${sensor.id}:`)) continue;
        const metric = key.slice(sensor.id.length + 1);
        const cur = latest[key];
        if (!cur) continue;
        const unit = metricUnit(metric);
        parts.push(`${metricLabel(metric)} ${formatMetric(metric, cur.value)}${unit}`);
      }
      if (parts.length) lines.push(`• ${sensor.name}: ${parts.join(", ")}`);
    }
    const body = lines.length
      ? lines.join("\n")
      : "(sensor data မရှိသေးပါ)";
    return `🌱 ကျွန်တော့် Smart Farm အခြေအနေ (ယခု)\n\n${body}\n\n#GreenWave #SmartFarm`;
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await createPost({
      content: buildSummary(),
      visibility: "public",
      media: [],
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
      setTimeout(() => setDone(false), 3000);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={share} disabled={busy} size="sm" variant="outline">
        {busy ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : done ? (
          <Check className="mr-1 h-4 w-4 text-emerald-600" />
        ) : (
          <Share2 className="mr-1 h-4 w-4" />
        )}
        {done ? "မျှဝေပြီး" : "အခြေအနေ မျှဝေရန်"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
