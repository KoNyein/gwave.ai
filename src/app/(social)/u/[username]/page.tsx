import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FollowButton } from "@/components/social/follow-button";
import { FriendButton } from "@/components/social/friend-button";
import { MemberBadge } from "@/components/social/member-badge";
import { ProfileActions } from "@/components/social/profile-actions";
import { PostFeed } from "@/components/social/post-feed";
import { ProfileTabs } from "@/components/social/profile-tabs";
import { UserAvatar } from "@/components/social/user-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import {
  getFriendCount,
  getFriends,
  getFriendState,
  isFollowing,
} from "@/lib/db/friends";
import { getProfilePosts } from "@/lib/db/posts";
import { displayName, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const t = await getTranslations("profile");
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/login");
  if (!viewer.username) redirect("/onboarding");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", params.username)
    .maybeSingle();
  if (!profile) notFound();

  const isSelf = viewer.id === profile.id;
  const [friendState, following, friendCount, friends, initialPage, blockRow] =
    await Promise.all([
      getFriendState(viewer.id, profile.id),
      isSelf ? Promise.resolve(false) : isFollowing(viewer.id, profile.id),
      getFriendCount(profile.id),
      getFriends(profile.id),
      getProfilePosts(profile.id, viewer.id),
      isSelf
        ? Promise.resolve(null)
        : supabase
            .from("blocks")
            .select("blocked_id")
            .match({ blocker_id: viewer.id, blocked_id: profile.id })
            .maybeSingle(),
    ]);
  const initiallyBlocked = Boolean(blockRow && "data" in blockRow && blockRow.data);

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
          className="h-40 bg-gradient-to-r from-primary to-accent sm:h-52"
          style={
            profile.cover_url
              ? {
                  backgroundImage: `url(${profile.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <CardContent className="relative px-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
              <Avatar className="-mt-12 h-28 w-28 border-4 border-background sm:-mt-14 sm:h-32 sm:w-32">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="" />
                ) : null}
                <AvatarFallback className="text-3xl">
                  {initials(profile)}
                </AvatarFallback>
              </Avatar>
              <div className="pb-1">
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                  {displayName(profile)}
                  <MemberBadge role={profile.role} />
                </h1>
                <p className="text-sm text-muted-foreground">
                  @{profile.username} · {t("friendCount", { count: friendCount })}
                </p>
              </div>
            </div>
            {!isSelf ? (
              <div className="flex gap-2 pb-1">
                <FriendButton profileId={profile.id} state={friendState} />
                <FollowButton profileId={profile.id} following={following} />
                <ProfileActions
                  profileId={profile.id}
                  initiallyBlocked={initiallyBlocked}
                />
              </div>
            ) : null}
          </div>
          {profile.bio ? (
            <p className="mt-3 max-w-xl text-sm">{profile.bio}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Tabs */}
      <ProfileTabs
        posts={
          <PostFeed
            initialPage={initialPage}
            currentUser={currentUser}
            scope="profile"
            contextId={profile.id}
            showComposer={isSelf}
          />
        }
        about={
          <Card>
            <CardContent className="space-y-3 p-6 text-sm">
              <div>
                <p className="font-semibold">{t("aboutBio")}</p>
                <p className="text-muted-foreground">
                  {profile.bio || t("aboutEmpty")}
                </p>
              </div>
              <div>
                <p className="font-semibold">{t("aboutJoined")}</p>
                <p className="text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        }
        friends={
          <Card>
            <CardContent className="p-6">
              {friends.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t("noFriends")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {friends.map((friend) => (
                    <Link
                      key={friend.id}
                      href={friend.username ? `/u/${friend.username}` : "#"}
                      className="flex items-center gap-2 rounded-lg border p-2 transition-colors hover:bg-muted"
                    >
                      <UserAvatar profile={friend} linked={false} />
                      <span className="truncate text-sm font-medium">
                        {displayName(friend)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
