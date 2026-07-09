import { GraduationCap } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { TeacherReviewActions } from "@/components/admin/teacher-review-actions";
import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getTeacherApplications } from "@/lib/db/teachers";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TeacherApplicationStatus } from "@/types/database";

export const metadata = { title: "Teacher applications" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<TeacherApplicationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

/** Moderation queue for teacher applications. */
export default async function AdminTeachersPage() {
  await requireRole("moderator");
  const [t, apps] = await Promise.all([
    getTranslations("learn"),
    getTeacherApplications(),
  ]);

  return (
    <div className="space-y-3">
      <h1 className="flex items-center gap-2 text-lg font-bold">
        <GraduationCap className="h-5 w-5" /> {t("teacherApplications")}
      </h1>
      {apps.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("noApplications")}
          </CardContent>
        </Card>
      ) : (
        apps.map((app) => (
          <Card key={app.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <UserAvatar profile={app.user} className="h-8 w-8" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {displayName(app.user)}
                    <span
                      className={cn(
                        "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLE[app.status],
                      )}
                    >
                      {t(`status_${app.status}`)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(app.created_at)}
                    {app.subjects ? ` · ${app.subjects}` : ""}
                  </p>
                </div>
              </div>
              <p className="text-sm">{app.bio}</p>
              {app.status === "pending" ? (
                <TeacherReviewActions applicationId={app.id} />
              ) : app.review_note ? (
                <p className="text-xs text-muted-foreground">
                  {t("reviewNote")}: {app.review_note}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
