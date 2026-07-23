"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  NotificationItem,
  notificationHref,
} from "@/components/social/notification-item";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { createClient } from "@/lib/data/client";
import { displayName } from "@/lib/format";
import type { NotificationWithActor } from "@/types/social";

type Payload = { notifications: NotificationWithActor[]; unreadCount: number };

export function NotificationsButton({ userId }: { userId: string }) {
  const t = useTranslations("notifications");
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState<
    NotificationWithActor[] | null
  >(null);
  // Newest notification id we've already shown as an OS push, so we don't
  // re-notify on refetch.
  const lastPushedId = React.useRef<string | null>(null);

  const loadNotifications = React.useCallback(async (): Promise<Payload | null> => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) return null;
      const payload: Payload = await response.json();
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
      return payload;
    } catch {
      // Non-fatal; the bell simply shows no badge.
      return null;
    }
  }, []);

  /** Human-readable text for a notification (mirrors NotificationItem). */
  const messageOf = React.useCallback(
    (n: NotificationWithActor): string => {
      const name = n.actor ? displayName(n.actor) : t("someone");
      return (
        {
          friend_request: t("friendRequest", { name }),
          friend_accepted: t("friendAccepted", { name }),
          post_reaction: t("postReaction", { name }),
          post_comment: t("postComment", { name }),
          comment_reply: t("commentReply", { name }),
          post_share: t("postShare", { name }),
          new_follower: t("newFollower", { name }),
          live_started: t("liveStarted", { name }),
          device_alert: t("deviceAlert"),
        }[n.type] ?? t("title")
      );
    },
    [t],
  );

  /** Pop an OS/browser notification for a freshly-arrived item. */
  const pushOsNotification = React.useCallback(
    (n: NotificationWithActor) => {
      if (
        typeof Notification === "undefined" ||
        Notification.permission !== "granted" ||
        lastPushedId.current === n.id
      ) {
        return;
      }
      lastPushedId.current = n.id;
      try {
        const notif = new Notification("Gwave", {
          body: messageOf(n),
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: n.id,
        });
        notif.onclick = () => {
          window.focus();
          window.location.href = notificationHref(n);
          notif.close();
        };
      } catch {
        // Some browsers throw if constructed off a user gesture — ignore.
      }
    },
    [messageOf],
  );

  // Initial unread count + realtime subscription for new notifications.
  React.useEffect(() => {
    void loadNotifications();

    const db = createClient();
    const channel = db
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          setUnreadCount((count) => count + 1);
          // The realtime payload has no joined actor; refetch for the list,
          // then surface the newest one as an OS notification.
          void loadNotifications().then((payload) => {
            const newest = payload?.notifications[0];
            if (newest) pushOsNotification(newest);
          });
        },
      )
      .subscribe();

    return () => {
      void db.removeChannel(channel);
    };
  }, [userId, loadNotifications, pushOsNotification]);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Opening the bell is a user gesture — a good moment to ask for
      // permission to show OS notifications (once).
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      ) {
        try {
          await Notification.requestPermission();
        } catch {
          // Older browsers use a callback API — safe to ignore.
        }
      }
      await loadNotifications();
      if (unreadCount > 0) {
        setUnreadCount(0);
        setNotifications(
          (previous) =>
            previous?.map((n) => ({ ...n, read: true })) ?? previous,
        );
        await markAllNotificationsRead();
      }
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={t("title")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-base font-semibold">{t("title")}</span>
          <Link
            href="/notifications"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            {t("seeAll")}
          </Link>
        </div>
        {notifications === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
