import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FollowButton } from "@/components/social/follow-button";
import { FriendButton } from "@/components/social/friend-button";
import { MessageButton } from "@/components/social/message-button";
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
import { LevelBadge } from "@/components/learn/level-badge";
import { getCertificatesForUser } from "@/lib/db/certificates";
import { getLearningPoints, getProjectsForUser } from "@/lib/db/learn";
import { getProfilePhotos, getProfilePosts } from "@/lib/db/posts";
import { PRESENCE } from "@/lib/presence";
import type { PresenceStatus } from "@/types/database";
import { displayName, initials } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage(
  props: {
    params: Promise<{ username: string }>;
  }
) {
  const params = await props.params;
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
  const [
    friendState,
    following,
    friendCount,
    friends,
    initialPage,
    photos,
    blockRow,
  ] =
    await Promise.all([
      getFriendState(viewer.id, profile.id),
      isSelf ? Promise.resolve(false) : isFollowing(viewer.id, profile.id),
      getFriendCount(profile.id),
      getFriends(profile.id),
      // Posts/photos hit RLS-heavy queries — if one fails we still want the
      // profile (and its Message button) to render, so degrade to empty.
      getProfilePosts(profile.id, viewer.id).catch(() => ({
        posts: [],
        nextCursor: null,
      })),
      getProfilePhotos(profile.id).catch(() => []),
      isSelf
        ? Promise.resolve(null)
        : supabase
            .from("blocks")
            .select("blocked_id")
            .match({ blocker_id: viewer.id, blocked_id: profile.id })
            .maybeSingle(),
    ]);
  const initiallyBlocked = Boolean(blockRow && "data" in blockRow && blockRow.data);

  // Learning projects are private — only shown on your own profile.
  const [projects, learningPoints, certificates] = await Promise.all([
    isSelf ? getProjectsForUser(viewer.id, 6) : Promise.resolve([]),
    getLearningPoints(profile.id),
    getCertificatesForUser(profile.id),
  ]);

  // Extra profile stats + the public pages this person runs.
  const [postCountRes, followerRes, followingRes, ownedPagesRes] =
    await Promise.all([
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", profile.id)
        .is("group_id", null)
        .is("page_id", null),
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("followee_id", profile.id),
      supabase
        .from("follows")
        .select("followee_id", { count: "exact", head: true })
        .eq("follower_id", profile.id),
      supabase
        .from("pages")
        .select("id, name, slug, avatar_url")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(6)
        .returns<
          { id: string; name: string; slug: string; avatar_url: string | null }[]
        >(),
    ]);

  const stats = [
    { label: t("postsLabel"), value: postCountRes.count ?? 0 },
    { label: t("friendsLabel"), value: friendCount },
    { label: t("followersLabel"), value: followerRes.count ?? 0 },
    { label: t("followingLabel"), value: followingRes.count ?? 0 },
  ];
  const ownedPages = ownedPagesRes.data ?? [];

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
                <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
                  {displayName(profile)}
                  <MemberBadge role={profile.role} />
                  {profile.presence_status &&
                  profile.presence_status !== "invisible" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <span
                        className={`h-2 w-2 rounded-full ${PRESENCE[profile.presence_status as PresenceStatus].dot}`}
                      />
                      {PRESENCE[profile.presence_status as PresenceStatus].label}
                    </span>
                  ) : null}
                </h1>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  @{profile.username} · {t("friendCount", { count: friendCount })}
                  {learningPoints > 0 ? (
                    <LevelBadge points={learningPoints} compact />
                  ) : null}
                </p>
              </div>
            </div>
            {!isSelf ? (
              <div className="flex flex-wrap gap-2 pb-1">
                <FriendButton profileId={profile.id} state={friendState} />
                <MessageButton profileId={profile.id} />
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

      {/* Stats strip */}
      <Card>
        <CardContent className="grid grid-cols-4 divide-x p-0">
          {stats.map((s) => (
            <div key={s.label} className="px-2 py-3 text-center">
              <p className="text-lg font-bold tabular-nums">
                {s.value.toLocaleString("en-US")}
              </p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pages this person runs */}
      {ownedPages.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-semibold">{t("runsPages")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ownedPages.map((pg) => (
                <Link
                  key={pg.id}
                  href={`/pages/${pg.slug}`}
                  className="flex items-center gap-2 rounded-lg border p-2 transition-colors hover:bg-muted"
                >
                  <Avatar className="h-9 w-9 rounded-lg">
                    {pg.avatar_url ? (
                      <AvatarImage src={pg.avatar_url} alt="" />
                    ) : null}
                    <AvatarFallback className="rounded-lg text-xs">
                      {pg.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">{pg.name}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Photos preview — always visible on the overview */}
      {photos.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-semibold">📷 ဓာတ်ပုံများ</p>
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
              {photos.slice(0, 12).map((photo) => (
                <Link
                  key={`ov-${photo.post_id}-${photo.storage_path}`}
                  href={`/p/${photo.post_id}`}
                  className="relative aspect-square overflow-hidden rounded-md bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl(photo.storage_path)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Course completion certificates — public, like a trophy shelf */}
      {certificates.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-semibold">🎓 အောင်လက်မှတ်များ</p>
            <div className="flex flex-wrap gap-2">
              {certificates.map((cert) => (
                <Link
                  key={cert.id}
                  href={`/learn/certificate/${cert.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
                >
                  🏅 {cert.track_title}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* My learning projects (own profile only) */}
      {isSelf && projects.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-semibold">{t("myProjects")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={
                    project.track_slug === "playground"
                      ? "/learn/playground"
                      : `/learn/${project.track_slug}/${project.lesson_slug}`
                  }
                  className="rounded-lg border p-3 transition-colors hover:bg-muted"
                >
                  <p className="truncate text-sm font-medium">{project.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.trackTitle} ·{" "}
                    {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
        photos={
          <Card>
            <CardContent className="p-4">
              {photos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("noPhotos")}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <Link
                      key={`${photo.post_id}-${photo.storage_path}`}
                      href={`/p/${photo.post_id}`}
                      className="relative aspect-square overflow-hidden rounded-md bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaUrl(photo.storage_path)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform hover:scale-105"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
