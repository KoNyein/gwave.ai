import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";

import { CreatorAnalytics } from "@/components/reels/creator-analytics";
import { getCurrentProfile } from "@/lib/auth";
import {
  getCreatorDailyStats,
  getCreatorMonthlyStats,
} from "@/lib/db/reels";

export const metadata = { title: "Creator analytics" };
export const dynamic = "force-dynamic";

export default async function ReelsAnalyticsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [daily, monthly] = await Promise.all([
    getCreatorDailyStats(30),
    getCreatorMonthlyStats(12),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/reels"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Reels
      </Link>

      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">📊 Creator Analytics</h1>
          <p className="text-sm text-muted-foreground">
            ကြည့်ရှုမှု / Like / ကြည့်ချိန် / ဝင်ငွေ — နေ့စဉ် & လစဉ် အသေးစိတ်
          </p>
        </div>
      </div>

      <CreatorAnalytics daily={daily} monthly={monthly} />
    </div>
  );
}
