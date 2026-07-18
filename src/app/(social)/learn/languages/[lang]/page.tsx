import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getTypingSummary } from "@/lib/db/typing";
import { getLangCourse } from "@/lib/learn/languages";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const course = getLangCourse(params.lang);
  return { title: course ? course.label : "Language" };
}

export default async function LanguageCoursePage(
  props: {
    params: Promise<{ lang: string }>;
  }
) {
  const params = await props.params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const course = getLangCourse(params.lang);
  if (!course) notFound();

  const typing = await getTypingSummary(profile.id, course.slug);

  return (
    <div className="space-y-4">
      <Link
        href="/learn/languages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {course.label}
      </Link>

      <div className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden>
          {course.flag}
        </span>
        <div>
          <h1 className="text-xl font-bold">{course.nativeLabel}</h1>
          <p className="text-sm text-muted-foreground">{course.description}</p>
        </div>
      </div>

      {typing.attempts > 0 ? (
        <Card>
          <CardContent className="flex items-center justify-around gap-2 p-3 text-center">
            <div>
              <p className="text-lg font-bold">🏆 {typing.bestWpm}</p>
              <p className="text-[11px] text-muted-foreground">အမြန်ဆုံး WPM</p>
            </div>
            <div>
              <p className="text-lg font-bold">🎯 {typing.avgAccuracy}%</p>
              <p className="text-[11px] text-muted-foreground">ပျမ်းမျှ တိကျမှု</p>
            </div>
            <div>
              <p className="text-lg font-bold">⌨️ {typing.attempts}</p>
              <p className="text-[11px] text-muted-foreground">လေ့ကျင့်ကြိမ်</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        {course.units.map((unit) => (
          <Link
            key={unit.slug}
            href={`/learn/languages/${course.slug}/${unit.slug}`}
            className="block"
          >
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="text-2xl" aria-hidden>
                  {unit.emoji}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{unit.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {unit.subtitle} · {unit.items.length}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
