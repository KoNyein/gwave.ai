import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CreatePageDialog } from "@/components/pages/create-page-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getDiscoverPages, getMyPages } from "@/lib/db/pages";
import type { Page } from "@/types/database";

function PageCard({
  page,
  followersLabel,
}: {
  page: Page;
  followersLabel: string;
}) {
  return (
    <Link
      href={`/pages/${page.slug}`}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
    >
      <Avatar className="h-14 w-14 rounded-lg">
        {page.avatar_url ? <AvatarImage src={page.avatar_url} alt="" /> : null}
        <AvatarFallback className="rounded-lg">
          <Flag className="h-6 w-6" />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{page.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {page.category ? `${page.category} · ` : ""}
          {followersLabel}
        </p>
      </div>
    </Link>
  );
}

export default async function PagesPage() {
  const t = await getTranslations("pages");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding");

  const [myPages, discover] = await Promise.all([
    getMyPages(profile.id),
    getDiscoverPages(profile.id),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <CreatePageDialog />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("myPages")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myPages.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noPages")}
            </p>
          ) : (
            myPages.map((page) => (
              <PageCard
                key={page.id}
                page={page}
                followersLabel={t("followerCount", {
                  count: page.follower_count,
                })}
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
            {discover.map((page) => (
              <PageCard
                key={page.id}
                page={page}
                followersLabel={t("followerCount", {
                  count: page.follower_count,
                })}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
