import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getLangCourse } from "@/lib/learn/languages";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { lang: string } }) {
  const course = getLangCourse(params.lang);
  return { title: course ? course.label : "Language" };
}

export default async function LanguageCoursePage({
  params,
}: {
  params: { lang: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const course = getLangCourse(params.lang);
  if (!course) notFound();

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
