import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Bot,
  Code2,
  FlaskConical,
  Gamepad2,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ageBandOf, getCurrentProfile } from "@/lib/auth";
import { headingForBand, tracksForBand } from "@/lib/learn/lessons";

export const metadata = { title: "Learn" };
export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  FlaskConical,
  Bot,
  Code2,
  Sprout,
};

export default async function LearnPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const band = ageBandOf(profile.birth_date);
  const tracks = tracksForBand(band);
  const showGame = band === "child" || band === "preteen" || band === "unknown";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Learn</h1>
          <p className="text-sm text-muted-foreground">{headingForBand(band)}</p>
        </div>
      </div>

      {showGame && (
        <Link href="/learn/game" className="block">
          <Card className="overflow-hidden transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Gamepad2 className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold">Grow-a-Garden 🎮</p>
                <p className="text-sm text-muted-foreground">
                  A fun game: give each plant water and sunlight to make it bloom.
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="space-y-3">
        {tracks.map((track) => {
          const Icon = ICONS[track.icon] ?? BookOpen;
          return (
            <Link key={track.slug} href={`/learn/${track.slug}`} className="block">
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{track.title}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        {track.lessons.length} lessons
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {track.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          More lessons are on the way. 🌱
        </CardContent>
      </Card>
    </div>
  );
}
