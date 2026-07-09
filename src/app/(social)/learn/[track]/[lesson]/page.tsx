import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { CircuitGame } from "@/components/learn/circuit-game";
import { CodePlayground } from "@/components/learn/code-playground";
import {
  LessonStartMarker,
  ReadingProgressTracker,
} from "@/components/learn/progress-tracker";
import { Quiz } from "@/components/learn/quiz";
import { RobotGame } from "@/components/learn/robot-game";
import { Card, CardContent } from "@/components/ui/card";
import { getLocale } from "next-intl/server";

import { LessonAudio } from "@/components/learn/lesson-audio";
import { LessonVideo } from "@/components/learn/lesson-video";
import { PythonPlayground } from "@/components/learn/python-playground";
import { SqlPlayground } from "@/components/learn/sql-playground";
import { ageBandOf, getCurrentProfile } from "@/lib/auth";
import { getProjectForLesson } from "@/lib/db/learn";
import { localizeLesson } from "@/lib/learn/i18n";
import { getLesson, tracksForBand } from "@/lib/learn/lessons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { track: string; lesson: string };
}) {
  return {
    title: getLesson(params.track, params.lesson)?.lesson.title ?? "Lesson",
  };
}

export default async function LessonPage({
  params,
}: {
  params: { track: string; lesson: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const found = getLesson(params.track, params.lesson);
  if (!found) notFound();

  const band = ageBandOf(profile.birth_date);
  const allowed = tracksForBand(band).some((t) => t.slug === found.track.slug);
  if (!allowed) redirect("/learn");

  // Localize lesson content to the viewer's language (falls back to English).
  const locale = await getLocale();
  const { track, lesson } = localizeLesson(found.track, found.lesson, locale);

  const index = track.lessons.findIndex((l) => l.slug === lesson.slug);
  const next = track.lessons[index + 1];

  // Text read aloud by the audio explainer (Burmese when the site is in
  // Burmese) — title, summary and every section's heading + body. Code
  // samples are deliberately excluded.
  const narration = [
    lesson.title,
    lesson.summary,
    ...(lesson.sections ?? []).flatMap((s) => [s.heading, s.body]),
  ]
    .filter(Boolean)
    .join(". ");

  // Saved game/playground state for resume (only these kinds persist state).
  const persistedKinds = ["code", "robot", "circuit", "python", "sql"];
  const project = persistedKinds.includes(lesson.kind)
    ? await getProjectForLesson(profile.id, track.slug, lesson.slug)
    : null;
  const lessonRef = {
    trackSlug: track.slug,
    lessonSlug: lesson.slug,
    initialData: project?.data ?? null,
  };

  return (
    <div className="space-y-4">
      {lesson.kind === "reading" ? (
        <ReadingProgressTracker
          trackSlug={track.slug}
          lessonSlug={lesson.slug}
        />
      ) : (
        <LessonStartMarker trackSlug={track.slug} lessonSlug={lesson.slug} />
      )}

      <Link
        href={`/learn/${track.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {track.title}
      </Link>

      <div className="space-y-2">
        <div>
          <h1 className="text-xl font-bold">{lesson.title}</h1>
          <p className="text-sm text-muted-foreground">{lesson.summary}</p>
        </div>
        <LessonAudio text={narration} locale={locale} />
      </div>

      {lesson.youtubeId ? (
        <LessonVideo youtubeId={lesson.youtubeId} title={lesson.title} />
      ) : null}

      {lesson.sections?.map((section, i) => (
        <Card key={i}>
          <CardContent className="space-y-1 p-4">
            <h2 className="font-semibold">{section.heading}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
            {section.code ? (
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
                {section.code}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {lesson.kind === "code" && lesson.code && (
        <CodePlayground
          starter={lesson.code}
          lesson={lessonRef}
          title={lesson.title}
        />
      )}

      {lesson.kind === "python" && lesson.pythonCode !== undefined && (
        <PythonPlayground
          starter={lesson.pythonCode}
          lesson={lessonRef}
          title={lesson.title}
        />
      )}

      {lesson.kind === "sql" && lesson.sqlCode !== undefined && (
        <SqlPlayground
          starter={lesson.sqlCode}
          lesson={lessonRef}
          title={lesson.title}
        />
      )}

      {lesson.kind === "robot" && <RobotGame lesson={lessonRef} />}

      {lesson.kind === "circuit" && <CircuitGame lesson={lessonRef} />}

      {lesson.kind === "quiz" && lesson.quiz && (
        <Quiz questions={lesson.quiz} lesson={lessonRef} />
      )}

      {next ? (
        <Link
          href={`/learn/${track.slug}/${next.slug}`}
          className="flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <span>
            <span className="text-xs text-muted-foreground">Next lesson</span>
            <span className="block font-medium">{next.title}</span>
          </span>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      ) : (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            🎉 You finished the {track.title} track!{" "}
            <Link href="/learn" className="font-medium text-primary hover:underline">
              Explore more
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
