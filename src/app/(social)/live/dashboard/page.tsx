import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

import { StreamerDashboard } from "@/components/live/streamer-dashboard";
import { getCurrentProfile } from "@/lib/auth";
import { getHostDashboard } from "@/lib/db/live";

export const metadata = { title: "Streamer dashboard" };
export const dynamic = "force-dynamic";

export default async function LiveDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const data = await getHostDashboard(profile.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/live"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Live
      </Link>

      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LayoutDashboard className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">📊 Streamer Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            သင့် live stream များ၏ ကြည့်သူ / react / chat စာရင်း
          </p>
        </div>
      </div>

      <StreamerDashboard data={data} />
    </div>
  );
}
