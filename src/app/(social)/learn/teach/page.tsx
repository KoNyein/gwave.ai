import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, GraduationCap } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { TeachApplyForm } from "@/components/learn/teach-apply-form";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getMyTeacherApplication } from "@/lib/db/teachers";

export const metadata = { title: "Become a teacher" };
export const dynamic = "force-dynamic";

/** Apply to teach live classes; shows current application status. */
export default async function TeachPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const t = await getTranslations("learn");

  const application = await getMyTeacherApplication(profile.id);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        href="/learn/live"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("liveClasses")}
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <GraduationCap className="h-5 w-5 text-primary" /> {t("becomeTeacher")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("teachSubtitle")}</p>
      </div>

      {profile.is_teacher ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">{t("alreadyTeacher")}</p>
              <Link href="/learn/live/new" className="text-sm text-primary hover:underline">
                {t("startClass")} →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : application?.status === "pending" ? (
        <Card>
          <CardContent className="p-6 text-sm">
            <p className="font-semibold text-yellow-700">{t("applicationPending")}</p>
            <p className="mt-1 text-muted-foreground">{t("applicationPendingHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            {application?.status === "rejected" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {t("applicationRejected")}
                {application.review_note ? ` — ${application.review_note}` : ""}
              </div>
            ) : null}
            <TeachApplyForm existing={application} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
