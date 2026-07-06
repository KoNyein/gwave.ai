"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { NotificationItem } from "@/components/social/notification-item";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { createClient } from "@/lib/supabase/client";
import type { NotificationWithActor } from "@/types/social";

export function NotificationsButton({ userId }: { userId: string }) {
  const t = useTranslations("notifications");
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState<
    NotificationWithActor[] | null
  >(null);

  const loadNotifications = React.useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) return;
      const payload: {
        notifications: NotificationWithActor[];
        unreadCount: number;
      } = await response.json();
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } catch {
      // Non-fatal; the bell simply shows no badge.
    }
  }, []);

  // Initial unread count + realtime subscription for new notifications.
  React.useEffect(() => {
    void loadNotifications();

    const supabase = createClient();
    const channel = supabase
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
          // The realtime payload has no joined actor; refetch for the list.
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
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
