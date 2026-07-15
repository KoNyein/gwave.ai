import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Globe, Lock, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GroupTabs } from "@/components/groups/group-tabs";
import { JoinGroupButton } from "@/components/groups/join-group-button";
import { MemberRow } from "@/components/groups/member-row";
import { PostFeed } from "@/components/social/post-feed";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getGroupCameras } from "@/lib/db/cctv";
import {
  getGroupBySlug,
  getGroupMembers,
  getGroupMembership,
} from "@/lib/db/groups";
import { getGroupPosts } from "@/lib/db/posts";
import type { FeedPage } from "@/types/social";

export default async function GroupPage({
  params,
}: {
  params: { slug: string };
}) {
  const t = await getTranslations("groups");
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/login");
  if (!viewer.username) redirect("/onboarding");

  const group = await getGroupBySlug(params.slug);
  if (!group) notFound();

  const membership = await getGroupMembership(group.id, viewer.id);
  const isMember = membership.kind === "member";
  const canManage =
    isMember && (membership.role === "admin" || membership.role === "moderator");
  const canViewFeed = group.privacy === "public" || isMember;

  const emptyPage: FeedPage = { posts: [], nextCursor: null };
  const [initialPage, members, requests, cameras] = await Promise.all([
    canViewFeed
      ? getGroupPosts(group.id, viewer.id)
      : Promise.resolve(emptyPage),
    getGroupMembers(group.id, "active"),
    canManage ? getGroupMembers(group.id, "pending") : Promise.resolve([]),
    isMember ? getGroupCameras(group.id) : Promise.resolve([]),
  ]);

  const currentUser = {
    id: viewer.id,
    username: viewer.username,
    full_name: viewer.full_name,
    avatar_url: viewer.avatar_url,
  };
  const PrivacyIcon = group.privacy === "public" ? Globe : Lock;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="overflow-hidden">
        <div
          className="h-32 bg-gradient-to-r from-primary to-accent sm:h-44"
          style={
            group.cover_url
              ? {
                  backgroundImage: `url(${group.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">{group.name}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <PrivacyIcon className="h-3.5 w-3.5" />
              {group.privacy === "public" ? t("public") : t("private")}
              {" · "}
              {t("memberCount", { count: group.member_count })}
            </p>
            {group.description ? (
              <p className="mt-1 max-w-xl text-sm">{group.description}</p>
            ) : null}
          </div>
          <JoinGroupButton
            groupId={group.id}
            membership={membership}
            isOwner={group.owner_id === viewer.id}
          />
        </CardContent>
      </Card>

      {/* Cameras shared with this group (members only) */}
      {cameras.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Video className="h-4 w-4 text-primary" /> {t("cameras")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cameras.map((cam) => (
                <Link
                  key={cam.id}
                  href={`/watch/${cam.share_token}`}
                  className="flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Video className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-medium">
                    {cam.title}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Tabs */}
      <GroupTabs
        discussion={
          canViewFeed ? (
            <PostFeed
              initialPage={initialPage}
              currentUser={currentUser}
              scope="group"
              contextId={group.id}
              showComposer={isMember}
              composerContext={{ groupId: group.id }}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("privateFeedLocked")}
                </p>
              </CardContent>
            </Card>
          )
        }
        members={
          <Card>
            <CardContent className="divide-y p-4">
              {members.map((member) => (
                <MemberRow
                  key={member.user_id}
                  member={member}
                  groupId={group.id}
                  canManage={canManage && member.user_id !== viewer.id}
                />
              ))}
            </CardContent>
          </Card>
        }
        requests={
          canManage ? (
            <Card>
              <CardContent className="divide-y p-4">
                {requests.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t("noRequests")}
                  </p>
                ) : (
                  requests.map((member) => (
                    <MemberRow
                      key={member.user_id}
                      member={member}
                      groupId={group.id}
                      canManage
                      isPendingRequest
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ) : undefined
        }
        requestCount={requests.length}
      />
    </div>
  );
}
