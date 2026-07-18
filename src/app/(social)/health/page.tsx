import { redirect } from "next/navigation";
import { HeartPulse } from "lucide-react";

import { ConnectPanel } from "@/components/health/connect-panel";
import { HealthDetails } from "@/components/health/health-details";
import { HealthSummary } from "@/components/health/health-summary";
import { ManualLog } from "@/components/health/manual-log";
import { PhonePedometer } from "@/components/health/phone-pedometer";
import { ScreenTimeTracker } from "@/components/health/screen-time-tracker";
import { getCurrentProfile } from "@/lib/auth";
import {
  getConnections,
  getDailySummaries,
  getLatestSummary,
} from "@/lib/db/health";
import { enabledProviders } from "@/lib/health/registry";

export const dynamic = "force-dynamic";
export const metadata = { title: "Health" };

/**
 * Health dashboard. Cloud providers (Fitbit / Google Fit) sync steps / heart
 * rate / sleep; the manual log and phone step-counter work with no device or
 * account, so any phone can use it. All data is owner-private (RLS).
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
            ခြေလှမ်း၊ နှလုံးခုန်နှုန်း၊ အိပ်ချိန် — နာရီ ဒါမှမဟုတ် ဖုန်းနဲ့။
          </p>
        </div>
      </div>

      <HealthSummary latest={latest} week={week} />
      <HealthDetails week={week} />
      <ConnectPanel connections={connections} providers={enabledProviders()} />
      <ScreenTimeTracker />
      <PhonePedometer />
      <ManualLog />
    </div>
  );
}
