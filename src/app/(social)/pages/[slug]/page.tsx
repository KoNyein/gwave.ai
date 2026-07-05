import { notFound, redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FollowPageButton } from "@/components/pages/follow-page-button";
import { PageTabs } from "@/components/pages/page-tabs";
import { PostFeed } from "@/components/social/post-feed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getPageBySlug, isFollowingPage } from "@/lib/db/pages";
import { getPagePosts } from "@/lib/db/posts";

export default async function PageDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const t = await getTranslations("pages");
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/login");
  if (!viewer.username) redirect("/onboarding");

  const page = await getPageBySlug(params.slug);
  if (!page) notFound();

  const isOwner = page.owner_id === viewer.id;
  const [following, initialPage] = await Promise.all([
    isOwner ? Promise.resolve(false) : isFollowingPage(page.id, viewer.id),
    getPagePosts(page.id, viewer.id),
  ]);

  const currentUser = {
    id: viewer.id,
    username: viewer.username,
    full_name: viewer.full_name,
    avatar_url: viewer.avatar_url,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="overflow-hidden">
        <div
          className="h-32 bg-gradient-to-r from-primary to-accent sm:h-44"
          style={
            page.cover_url
              ? {
                  backgroundImage: `url(${page.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <CardContent className="relative px-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
              <Avatar className="-mt-10 h-24 w-24 rounded-xl border-4 border-background">
                {page.avatar_url ? (
                  <AvatarImage src={page.avatar_url} alt="" />
                ) : null}
                <AvatarFallback className="rounded-xl">
                  <Flag className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <div className="pb-1">
                <h1 className="text-2xl font-bold">{page.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {page.category ? `${page.category} · ` : ""}
                  {t("followerCount", { count: page.follower_count })}
                </p>
              </div>
            </div>
            {!isOwner ? (
              <div className="pb-1">
                <FollowPageButton pageId={page.id} following={following} />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <PageTabs
        posts={
          <PostFeed
            initialPage={initialPage}
            currentUser={currentUser}
            scope="page"
            contextId={page.id}
            showComposer={isOwner}
            composerContext={{ pageId: page.id }}
          />
        }
        about={
          <Card>
            <CardContent className="space-y-3 p-6 text-sm">
              <div>
                <p className="font-semibold">{t("aboutDescription")}</p>
                <p className="text-muted-foreground">
                  {page.description || t("aboutEmpty")}
                </p>
              </div>
              {page.category ? (
                <div>
                  <p className="font-semibold">{t("category")}</p>
                  <p className="text-muted-foreground">{page.category}</p>
                </div>
              ) : null}
              <div>
                <p className="font-semibold">{t("aboutCreated")}</p>
                <p className="text-muted-foreground">
                  {new Date(page.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
