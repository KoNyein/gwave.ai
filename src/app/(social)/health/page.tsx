import { redirect } from "next/navigation";
import { HeartPulse } from "lucide-react";

import { ConnectPanel } from "@/components/health/connect-panel";
import { HealthSummary } from "@/components/health/health-summary";
import { getCurrentProfile } from "@/lib/auth";
import {
  getConnections,
  getDailySummaries,
  getLatestSummary,
} from "@/lib/db/health";
import { isTerraEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Health" };

/**
 * Health dashboard: connect a wearable (via Terra) and see synced steps / heart
 * rate / sleep. All data is owner-private (RLS). Works even before Terra is
 * configured — the connect button just explains it's not enabled yet.
 */
export default async function HealthPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [connections, week, latest] = await Promise.all([
    getConnections(profile.id),
    getDailySummaries(profile.id, 7),
    getLatestSummary(profile.id),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HeartPulse className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">ကျန်းမာရေး</h1>
          <p className="text-sm text-muted-foreground">
            နာရီ/ဖန်တီးနက် ချိတ်ပြီး ခြေလှမ်း၊ နှလုံးခုန်နှုန်း၊ အိပ်ချိန် ကြည့်ပါ။
          </p>
        </div>
      </div>

      <HealthSummary latest={latest} week={week} />
      <ConnectPanel connections={connections} enabled={isTerraEnabled()} />
    </div>
  );
}
