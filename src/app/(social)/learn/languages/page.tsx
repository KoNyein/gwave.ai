import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Languages } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { LANG_COURSES } from "@/lib/learn/languages";

export const metadata = { title: "Languages" };
export const dynamic = "force-dynamic";

export default async function LanguagesHubPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const t = await getTranslations("lang");

  return (
    <div className="space-y-5">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Learn
      </Link>

      <div className="flex items-center gap-2">
        <Languages className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {LANG_COURSES.map((course) => {
          const lessons = course.units.reduce((n, u) => n + u.items.length, 0);
          return (
            <Link
              key={course.slug}
              href={`/learn/languages/${course.slug}`}
              className="block"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex h-full flex-col items-center gap-1 p-5 text-center">
                  <span className="text-5xl" aria-hidden>
                    {course.flag}
                  </span>
                  <p className="mt-1 font-semibold">{course.nativeLabel}</p>
                  <p className="text-xs text-muted-foreground">{course.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course.description}
                  </p>
                  <span className="mt-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                    {t("unitsWords", {
                      units: course.units.length,
                      words: lessons,
                    })}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          {t("browserNote")}
        </CardContent>
      </Card>
    </div>
  );
}
