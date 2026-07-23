"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationWithActor } from "@/types/social";

/** Where clicking the notification takes the user. */
export function notificationHref(notification: NotificationWithActor): string {
  if (notification.type === "device_alert") return "/farm/rules";
  if (notification.post_id) return `/p/${notification.post_id}`;
  if (notification.actor?.username) return `/u/${notification.actor.username}`;
  return "/notifications";
}

export function NotificationItem({
  notification,
  onNavigate,
}: {
  notification: NotificationWithActor;
  onNavigate?: () => void;
}) {
  const t = useTranslations("notifications");
  const actorName = notification.actor
    ? displayName(notification.actor)
    : t("someone");

  const message = {
    friend_request: t("friendRequest", { name: actorName }),
    friend_accepted: t("friendAccepted", { name: actorName }),
    post_reaction: t("postReaction", { name: actorName }),
    post_comment: t("postComment", { name: actorName }),
    comment_reply: t("commentReply", { name: actorName }),
    post_share: t("postShare", { name: actorName }),
    new_follower: t("newFollower", { name: actorName }),
    device_alert: t("deviceAlert"),
    live_started: t("liveStarted", { name: actorName }),
  }[notification.type];

  return (
    <Link
      href={notificationHref(notification)}
      onClick={onNavigate}
      className={cn(
        "flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted",
        !notification.read && "bg-secondary/60",
      )}
    >
      {notification.actor ? (
        <UserAvatar profile={notification.actor} linked={false} />
      ) : (
        <div className="h-10 w-10 rounded-full bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm">{message}</p>
        <p
          className={cn(
            "text-xs",
            notification.read
              ? "text-muted-foreground"
              : "font-medium text-primary",
          )}
        >
          {timeAgo(notification.created_at)}
        </p>
      </div>
      {!notification.read ? (
        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
      ) : null}
    </Link>
  );
}
