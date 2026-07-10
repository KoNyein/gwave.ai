import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { LanguageTrainer } from "@/components/learn/language-trainer";
import { getCurrentProfile } from "@/lib/auth";
import { getLangUnit } from "@/lib/learn/languages";

export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { lang: string; unit: string };
}) {
  const found = getLangUnit(params.lang, params.unit);
  return { title: found ? found.unit.title : "Lesson" };
}

export default async function LanguageUnitPage({
  params,
}: {
  params: { lang: string; unit: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const found = getLangUnit(params.lang, params.unit);
  if (!found) notFound();
  const { course, unit } = found;

  return (
    <div className="space-y-4">
      <Link
        href={`/learn/languages/${course.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {course.nativeLabel}
      </Link>

      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {unit.emoji}
        </span>
        <div>
          <h1 className="text-xl font-bold">{unit.title}</h1>
          <p className="text-sm text-muted-foreground">
            {course.flag} {unit.subtitle}
          </p>
        </div>
      </div>

      <LanguageTrainer items={unit.items} lang={course.bcp47} />
    </div>
  );
}
