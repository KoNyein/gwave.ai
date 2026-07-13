import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Radio } from "lucide-react";

import { TrackersManager } from "@/components/gps/trackers-manager";
import { getCurrentProfile } from "@/lib/auth";
import { getMyTrackers } from "@/lib/db/trackers";

export const metadata = { title: "Trackers" };
export const dynamic = "force-dynamic";

export default async function TrackersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const trackers = await getMyTrackers(profile.id);

  return (
    <div className="space-y-4">
      <Link
        href="/family"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Family
      </Link>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Radio className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">GPS Trackers</h1>
          <p className="text-sm text-muted-foreground">
            Bluetooth GPS · Wi-Fi · NFC · AirTag — အလွယ်တကူ တပ်ဆင်ပြီး တည်နေရာ မှတ်ပါ
          </p>
        </div>
      </div>

      <TrackersManager trackers={trackers} />
    </div>
  );
}
