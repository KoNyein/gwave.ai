import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GraduationCap, Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { listClasses } from "@/lib/db/live";
import { displayName, timeAgo } from "@/lib/format";

export const metadata = { title: "Live Classes" };
export const dynamic = "force-dynamic";

/** Learn Live: teacher-hosted classes — live now, then recent. */
export default async function LearnLivePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, classes] = await Promise.all([
    getTranslations("learn"),
    listClasses(),
  ]);
  const canHost =
    profile.is_teacher ||
    ["moderator", "admin", "super_admin"].includes(profile.role);

  return (
    <div className="space-y-4">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToLearn")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <GraduationCap className="h-5 w-5 text-primary" /> {t("liveClasses")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("liveClassesSubtitle")}
          </p>
        </div>
        {canHost ? (
          <Button asChild size="sm">
            <Link href="/learn/live/new">
              <Radio className="mr-1 h-4 w-4" /> {t("startClass")}
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href="/learn/teach">{t("becomeTeacher")}</Link>
          </Button>
        )}
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("noClassesYet")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {classes.map((session) => (
            <Link key={session.id} href={`/live/${session.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 p-3">
                  <UserAvatar profile={session.host} linked={false} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{session.title}</span>
                      {session.status === "live" ? (
                        <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                          ● {t("liveNow")}
                        </span>
                      ) : session.status === "ended" ? (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {t("ended")}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t("byTeacher", { name: displayName(session.host) })}
                      {" · "}
                      {timeAgo(session.created_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
