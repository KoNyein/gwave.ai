import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Braces,
  BrainCircuit,
  Code2,
  Cpu,
  Database,
  FileCode2,
  FlaskConical,
  Gamepad2,
  ListChecks,
  Palette,
  GraduationCap,
  Play,
  Rocket,
  Sprout,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ageBandOf, getCurrentProfile } from "@/lib/auth";
import { getLocale } from "next-intl/server";

import { LevelBadge } from "@/components/learn/level-badge";
import {
  getLearningPoints,
  getProgressForUser,
  getResumePointForUser,
} from "@/lib/db/learn";
import { localizeTrack, localizedLessonTitle } from "@/lib/learn/i18n";
import { headingForBand, tracksForBand } from "@/lib/learn/lessons";

export const metadata = { title: "Learn" };
export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  FlaskConical,
  Cpu,
  Bot,
  Code2,
  Sprout,
  FileCode2,
  Palette,
  Braces,
  Terminal,
  Database,
  BrainCircuit,
  ListChecks,
};

export default async function LearnPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const band = ageBandOf(profile.birth_date);
  const locale = await getLocale();
  const tracks = tracksForBand(band).map((t) => localizeTrack(t, locale));
  // The Grow-a-Garden mini game is light and fun for every age.
  const showGame = true;

  const [progressRows, resume, points] = await Promise.all([
    getProgressForUser(profile.id),
    getResumePointForUser(profile.id),
    getLearningPoints(profile.id),
  ]);
  const completedByTrack = new Map<string, number>();
  for (const row of progressRows) {
    if (row.status === "completed") {
      completedByTrack.set(
        row.track_slug,
        (completedByTrack.get(row.track_slug) ?? 0) + 1,
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Learn</h1>
          <p className="text-sm text-muted-foreground">{headingForBand(band)}</p>
        </div>
      </div>

      {/* Your learning level — grows with every completed lesson and quiz. */}
      <Card>
        <CardContent className="p-4">
          <LevelBadge points={points} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/learn/playground" className="block">
          <Card className="h-full overflow-hidden transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Rocket className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold">Code Playground 🚀</p>
                <p className="text-sm text-muted-foreground">
                  Free practice: write HTML, CSS &amp; JavaScript with
                  autocompletion and run it instantly.
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/learn/live" className="block">
          <Card className="h-full overflow-hidden transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold">Live Classes 🎓</p>
                <p className="text-sm text-muted-foreground">
                  Join a teacher&apos;s live video class — or apply to teach.
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {resume && (
        <Link
          href={`/learn/${resume.trackSlug}/${resume.lessonSlug}`}
          className="block"
        >
          <Card className="border-primary/40 bg-primary/5 transition-colors hover:bg-primary/10">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Play className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-medium text-primary">
                  Continue learning
                </p>
                <p className="font-semibold">
                  {localizedLessonTitle(
                    resume.trackSlug,
                    resume.lessonSlug,
                    resume.lessonTitle,
                    locale,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resume.trackTitle} · {resume.progressPct}% done
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

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
          const done = Math.min(
            completedByTrack.get(track.slug) ?? 0,
            track.lessons.length,
          );
          const pct = Math.round((done / track.lessons.length) * 100);
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
                        {done > 0
                          ? `${done}/${track.lessons.length} lessons`
                          : `${track.lessons.length} lessons`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {track.description}
                    </p>
                    {done > 0 && (
                      <div
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
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
