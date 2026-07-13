import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { GoLiveForm } from "@/components/live/go-live-form";
import { getCurrentProfile } from "@/lib/auth";
import { livekitConfigured } from "@/lib/livekit";

export const metadata = { title: "Go live" };
export const dynamic = "force-dynamic";

export default async function NewLivePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const browserBroadcast = livekitConfigured();

  return (
    <div className="space-y-4">
      <Link
        href="/live"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Live
      </Link>
      <div>
        <h1 className="text-xl font-bold">Go live</h1>
        <p className="text-sm text-muted-foreground">
          {browserBroadcast
            ? "Name your broadcast, then go live straight from your camera."
            : "Name your broadcast, then stream to it with OBS or any RTMP app."}
        </p>
      </div>
      <GoLiveForm browserBroadcast={browserBroadcast} />
    </div>
  );
}
