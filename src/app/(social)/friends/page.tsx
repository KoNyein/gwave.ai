import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FriendButton } from "@/components/social/friend-button";
import { UserAvatar } from "@/components/social/user-avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import {
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getSuggestions,
} from "@/lib/db/friends";
import { displayName } from "@/lib/format";
import type { AuthorSummary, FriendState } from "@/types/social";

function PersonRow({
  profile,
  action,
}: {
  profile: AuthorSummary;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <Link
        href={profile.username ? `/u/${profile.username}` : "#"}
        className="flex min-w-0 items-center gap-3"
      >
        <UserAvatar profile={profile} linked={false} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {displayName(profile)}
          </p>
          {profile.username ? (
            <p className="truncate text-xs text-muted-foreground">
              @{profile.username}
            </p>
          ) : null}
        </div>
      </Link>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export default async function FriendsPage() {
  const t = await getTranslations("friends");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding");

  const [incoming, outgoing, friends, suggestions] = await Promise.all([
    getIncomingRequests(profile.id),
    getOutgoingRequests(profile.id),
    getFriends(profile.id),
    getSuggestions(profile.id),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("title")}</h1>

      {incoming.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("requestsReceived", { count: incoming.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {incoming.map((request) => (
              <PersonRow
                key={request.id}
                profile={request.requester}
                action={
                  <FriendButton
                    profileId={request.requester.id}
                    state={
                      {
                        kind: "request_received",
                        friendshipId: request.id,
                      } satisfies FriendState
                    }
                  />
                }
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {outgoing.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("requestsSent")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {outgoing.map((request) => (
              <PersonRow
                key={request.id}
                profile={request.addressee}
                action={
                  <FriendButton
                    profileId={request.addressee.id}
                    state={
                      {
                        kind: "request_sent",
                        friendshipId: request.id,
                      } satisfies FriendState
                    }
                  />
                }
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("allFriends", { count: friends.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {friends.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noFriendsYet")}
            </p>
          ) : (
            friends.map((friend) => (
              <PersonRow key={friend.id} profile={friend} action={null} />
            ))
          )}
        </CardContent>
      </Card>

      {suggestions.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("suggestions")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {suggestions.map((suggestion) => (
              <PersonRow
                key={suggestion.id}
                profile={suggestion}
                action={
                  <FriendButton
                    profileId={suggestion.id}
                    state={{ kind: "none" } satisfies FriendState}
                  />
                }
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
