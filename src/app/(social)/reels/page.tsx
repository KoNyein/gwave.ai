import { redirect } from "next/navigation";
import { Clapperboard } from "lucide-react";

import { CreatorStudio } from "@/components/reels/creator-studio";
import { ReelUpload } from "@/components/reels/reel-upload";
import { ReelsFeed } from "@/components/reels/reels-feed";
import { getCurrentProfile } from "@/lib/auth";
import { getCreatorSummary, getReelsFeed } from "@/lib/db/reels";

export const metadata = { title: "Reels" };
export const dynamic = "force-dynamic";

export default async function ReelsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [reels, summary] = await Promise.all([
    getReelsFeed(30),
    getCreatorSummary(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Clapperboard className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Reels</h1>
          <p className="text-sm text-muted-foreground">
            ဗီဒီယိုတို — ကြည့်ရှုမှုနဲ့ Like တိုင်း ဝင်ငွေ ရရှိမည် 💰
          </p>
        </div>
      </div>

      <ReelUpload userId={profile.id} />

      {summary.reelCount > 0 ? <CreatorStudio summary={summary} /> : null}

      <ReelsFeed reels={reels} />
    </div>
  );
}
