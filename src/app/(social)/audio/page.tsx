import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Music } from "lucide-react";

import { AudioBrowse } from "@/components/audio/audio-browse";
import { getCurrentProfile } from "@/lib/auth";
import {
  getContinue,
  getTracksByIds,
  getTracksByKind,
  type AudioTrack,
} from "@/lib/db/audio";

export const metadata = { title: "Audio" };
export const dynamic = "force-dynamic";

export default async function AudioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, music, podcasts, audiobooks, resume] = await Promise.all([
    getTranslations("audio"),
    getTracksByKind("music"),
    getTracksByKind("podcast"),
    getTracksByKind("audiobook"),
    getContinue(profile.id),
  ]);

  // Resolve "continue listening" resume points to their tracks, keeping order.
  const resumeTracks = await getTracksByIds(resume.map((r) => r.track_id));
  const byId = new Map<string, AudioTrack>(resumeTracks.map((x) => [x.id, x]));
  const continueList = resume
    .map((r) => {
      const track = byId.get(r.track_id);
      return track ? { track, position_s: r.position_s, duration_s: r.duration_s } : null;
    })
    .filter((x): x is { track: AudioTrack; position_s: number; duration_s: number | null } => x !== null);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Music className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <AudioBrowse
        music={music}
        podcasts={podcasts}
        audiobooks={audiobooks}
        continueList={continueList}
      />
    </div>
  );
}
