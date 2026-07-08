import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { CodePlayground } from "@/components/learn/code-playground";
import { Quiz } from "@/components/learn/quiz";
import { RobotGame } from "@/components/learn/robot-game";
import { Card, CardContent } from "@/components/ui/card";
import { ageBandOf, getCurrentProfile } from "@/lib/auth";
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
  const { track, lesson } = found;

  const band = ageBandOf(profile.birth_date);
  const allowed = tracksForBand(band).some((t) => t.slug === track.slug);
  if (!allowed) redirect("/learn");

  const index = track.lessons.findIndex((l) => l.slug === lesson.slug);
  const next = track.lessons[index + 1];

  return (
    <div className="space-y-4">
      <Link
        href={`/learn/${track.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {track.title}
      </Link>

      <div>
        <h1 className="text-xl font-bold">{lesson.title}</h1>
        <p className="text-sm text-muted-foreground">{lesson.summary}</p>
      </div>

      {lesson.sections?.map((section, i) => (
        <Card key={i}>
          <CardContent className="space-y-1 p-4">
            <h2 className="font-semibold">{section.heading}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </CardContent>
        </Card>
      ))}

      {lesson.kind === "code" && lesson.code && (
        <CodePlayground starter={lesson.code} />
      )}

      {lesson.kind === "robot" && <RobotGame />}

      {lesson.kind === "quiz" && lesson.quiz && <Quiz questions={lesson.quiz} />}

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
