import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BookText,
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  HelpCircle,
  Terminal,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getLocale } from "next-intl/server";

import { ageBandOf, getCurrentProfile } from "@/lib/auth";
import { getTrackProgress } from "@/lib/db/learn";
import { localizeTrack } from "@/lib/learn/i18n";
import { getTrack, tracksForBand, type LessonKind } from "@/lib/learn/lessons";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<LessonKind, typeof BookText> = {
  reading: BookText,
  quiz: HelpCircle,
  code: Code2,
  robot: Bot,
  circuit: Cpu,
  python: Terminal,
  sql: Database,
};

export async function generateMetadata({
  params,
}: {
  params: { track: string };
}) {
  return { title: getTrack(params.track)?.title ?? "Learn" };
}

export default async function TrackPage({
  params,
}: {
  params: { track: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const rawTrack = getTrack(params.track);
  if (!rawTrack) notFound();

  // Only show tracks appropriate for the viewer's age band.
  const band = ageBandOf(profile.birth_date);
  const allowed = tracksForBand(band).some((t) => t.slug === rawTrack.slug);
  if (!allowed) redirect("/learn");

  const locale = await getLocale();
  const track = localizeTrack(rawTrack, locale);
  const progress = await getTrackProgress(profile.id, track.slug);

  return (
    <div className="space-y-4">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Learn
      </Link>
      <div>
        <h1 className="text-xl font-bold">{track.title}</h1>
        <p className="text-sm text-muted-foreground">{track.description}</p>
      </div>

      <div className="space-y-2">
        {track.lessons.map((lesson, i) => {
          const Icon = KIND_ICON[lesson.kind as LessonKind];
          const row = progress.get(lesson.slug);
          const completed = row?.status === "completed";
          return (
            <Link
              key={lesson.slug}
              href={`/learn/${track.slug}/${lesson.slug}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 p-3">
                  {completed ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                      <CheckCircle2
                        className="h-6 w-6 text-primary"
                        aria-label="Completed"
                      />
                    </span>
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary">
                      {i + 1}
                    </span>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{lesson.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {lesson.summary}
                      {completed && row?.score != null
                        ? ` · Score ${row.score}%`
                        : ""}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {lesson.minutes}m
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
