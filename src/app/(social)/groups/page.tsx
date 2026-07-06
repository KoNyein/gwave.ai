import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe, Lock, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getDiscoverGroups, getMyGroups } from "@/lib/db/groups";
import type { Group } from "@/types/database";

function GroupCard({
  group,
  membersLabel,
}: {
  group: Group;
  membersLabel: string;
}) {
  const PrivacyIcon = group.privacy === "public" ? Globe : Lock;
  return (
    <Link
      href={`/groups/${group.slug}`}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground"
        style={
          group.cover_url
            ? {
                backgroundImage: `url(${group.cover_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!group.cover_url ? <Users className="h-6 w-6" /> : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{group.name}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <PrivacyIcon className="h-3 w-3" />
          {membersLabel}
        </p>
      </div>
    </Link>
  );
}

export default async function GroupsPage() {
  const t = await getTranslations("groups");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding");

  const [myGroups, discover] = await Promise.all([
    getMyGroups(profile.id),
    getDiscoverGroups(profile.id),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <CreateGroupDialog />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("myGroups")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myGroups.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noGroups")}
            </p>
          ) : (
            myGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                membersLabel={t("memberCount", { count: group.member_count })}
              />
            ))
          )}
        </CardContent>
      </Card>

      {discover.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("discover")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {discover.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                membersLabel={t("memberCount", { count: group.member_count })}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
