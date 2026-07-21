import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ListChecks,
} from "lucide-react";

import { CircuitGame } from "@/components/learn/circuit-game";
import { CodeBlock } from "@/components/learn/code-block";
import { CodePlayground } from "@/components/learn/code-playground";
import { LessonRichText } from "@/components/learn/lesson-rich-text";
import {
  LessonStartMarker,
  ReadingProgressTracker,
} from "@/components/learn/progress-tracker";
import { Quiz } from "@/components/learn/quiz";
import { RobotGame } from "@/components/learn/robot-game";
import { Card, CardContent } from "@/components/ui/card";
import { getLocale, getTranslations } from "next-intl/server";

import { LessonAudio } from "@/components/learn/lesson-audio";
import { LessonComments } from "@/components/learn/lesson-comments";
import { LessonVideo } from "@/components/learn/lesson-video";
import { LessonYouTubeLink } from "@/components/learn/lesson-youtube-link";
import { PythonPlayground } from "@/components/learn/python-playground";
import { ScratchPlayground } from "@/components/learn/scratch-playground";
import { SqlPlayground } from "@/components/learn/sql-playground";
import { ageBandOf, getCurrentProfile } from "@/lib/auth";
import { getProjectForLesson, getTrackProgress } from "@/lib/db/learn";
import { getLessonComments } from "@/lib/db/lesson-comments";
import { localizeLesson } from "@/lib/learn/i18n";
import { getLesson, tracksForBand } from "@/lib/learn/lessons";

export const dynamic = "force-dynamic";

/** Per-kind badge (emoji + label) for the lesson header. */
const KIND_META: Record<string, { emoji: string; label: string }> = {
  reading: { emoji: "📖", label: "Reading" },
  quiz: { emoji: "❓", label: "Quiz" },
  code: { emoji: "💻", label: "Code lab" },
  python: { emoji: "🐍", label: "Python lab" },
  sql: { emoji: "🗄️", label: "SQL lab" },
  scratch: { emoji: "🧩", label: "Blocks lab" },
  robot: { emoji: "🤖", label: "Robot game" },
  circuit: { emoji: "⚡", label: "Circuit game" },
  game: { emoji: "🎮", label: "Game" },
  video: { emoji: "🎬", label: "Video" },
};

export async function generateMetadata(
  props: {
    params: Promise<{ track: string; lesson: string }>;
  }
) {
  const params = await props.params;
  return {
    title: getLesson(params.track, params.lesson)?.lesson.title ?? "Lesson",
  };
}

export default async function LessonPage(
  props: {
    params: Promise<{ track: string; lesson: string }>;
  }
) {
  const params = await props.params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const found = getLesson(params.track, params.lesson);
  if (!found) notFound();

  const band = ageBandOf(profile.birth_date);
  const allowed = tracksForBand(band).some((t) => t.slug === found.track.slug);
  if (!allowed) redirect("/learn");

  // Localize lesson content to the viewer's language (falls back to English).
  const locale = await getLocale();
  const t = await getTranslations("learn");
  const { track, lesson } = localizeLesson(found.track, found.lesson, locale);

  const index = track.lessons.findIndex((l) => l.slug === lesson.slug);
  const prev = index > 0 ? track.lessons[index - 1] : undefined;
  const next = track.lessons[index + 1];

  // The learner's position in the track, for the header progress bar.
  const progress = await getTrackProgress(profile.id, track.slug);
  const doneCount = track.lessons.filter(
    (l) => progress.get(l.slug)?.status === "completed",
  ).length;
  const thisDone = progress.get(lesson.slug)?.status === "completed";
  const kindMeta =
    KIND_META[lesson.kind] ?? { emoji: "📖", label: "Lesson" };

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
  const persistedKinds = ["code", "robot", "circuit", "python", "sql", "scratch"];
  const project = persistedKinds.includes(lesson.kind)
    ? await getProjectForLesson(profile.id, track.slug, lesson.slug)
    : null;
  const lessonRef = {
    trackSlug: track.slug,
    lessonSlug: lesson.slug,
    initialData: project?.data ?? null,
  };

  const comments = await getLessonComments(track.slug, lesson.slug);
  const commentUser = {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    role: profile.role,
  };

  const sections = lesson.sections ?? [];

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

      {/* Hero header: title, badges, track progress */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary">
            {kindMeta.emoji} {kindMeta.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> {lesson.minutes} min
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-muted-foreground">
            <ListChecks className="h-3 w-3" /> {index + 1} / {track.lessons.length}
          </span>
          {thisDone ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-primary-foreground">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight">{lesson.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{lesson.summary}</p>
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.round((doneCount / Math.max(track.lessons.length, 1)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {doneCount}/{track.lessons.length} · {track.title}
          </p>
        </div>
        <div className="mt-3">
          <LessonAudio text={narration} locale={locale} />
        </div>
      </div>

      {lesson.youtubeId ? (
        <LessonVideo youtubeId={lesson.youtubeId} title={lesson.title} />
      ) : lesson.youtubeQuery ? (
        <LessonYouTubeLink query={lesson.youtubeQuery} label={t("watchOnYouTube")} />
      ) : null}

      {/* "On this page" quick jumps for longer readings */}
      {sections.length > 3 ? (
        <div className="flex flex-wrap gap-2">
          {sections.map((s, i) => (
            <a
              key={i}
              href={`#s${i + 1}`}
              className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {i + 1}. {s.heading}
            </a>
          ))}
        </div>
      ) : null}

      {sections.map((section, i) => (
        <Card key={i} id={`s${i + 1}`} className="scroll-mt-20 overflow-hidden">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </span>
              <h2 className="font-semibold leading-snug">{section.heading}</h2>
            </div>
            <LessonRichText body={section.body} />
            {section.code ? (
              <CodeBlock code={section.code} label={kindMeta.label} />
            ) : null}
            {section.image ? (
              <figure className="pt-1">
                {/* Teaching image/diagram; may be an external photo or an
                    inline SVG data URI, so a plain img avoids the loader
                    allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={section.image.src}
                  alt={section.image.alt}
                  loading="lazy"
                  className="w-full rounded-xl border bg-white"
                />
                {section.image.caption ? (
                  <figcaption className="pt-1.5 text-center text-xs text-muted-foreground">
                    {section.image.caption}
                  </figcaption>
                ) : null}
              </figure>
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

      {lesson.kind === "scratch" && (
        <ScratchPlayground
          config={lesson.scratch}
          lesson={lessonRef}
          title={lesson.title}
        />
      )}

      {lesson.kind === "robot" && <RobotGame lesson={lessonRef} />}

      {lesson.kind === "circuit" && <CircuitGame lesson={lessonRef} />}

      {lesson.kind === "quiz" && lesson.quiz && (
        <Quiz questions={lesson.quiz} lesson={lessonRef} />
      )}

      {/* Prev / next navigation */}
      <div className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            href={`/learn/${track.slug}/${prev.slug}`}
            className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
            <span className="min-w-0">
              <span className="text-xs text-muted-foreground">Previous</span>
              <span className="block truncate text-sm font-medium">
                {prev.title}
              </span>
            </span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {next ? (
          <Link
            href={`/learn/${track.slug}/${next.slug}`}
            className="group flex items-center justify-end gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-right transition-colors hover:bg-primary/10"
          >
            <span className="min-w-0">
              <span className="text-xs text-muted-foreground">Next lesson</span>
              <span className="block truncate text-sm font-semibold text-primary">
                {next.title}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <Card className="sm:col-span-2">
            <CardContent className="p-5 text-center">
              <p className="text-2xl">🎉</p>
              <p className="mt-1 font-semibold">
                You finished the {track.title} track!
              </p>
              <Link
                href="/learn"
                className="mt-1 inline-block text-sm font-medium text-primary hover:underline"
              >
                Explore more courses →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <LessonComments
        trackSlug={track.slug}
        lessonSlug={lesson.slug}
        currentUser={commentUser}
        initialComments={comments}
      />
    </div>
  );
}
