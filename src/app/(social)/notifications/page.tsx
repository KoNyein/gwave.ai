import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { NotificationItem } from "@/components/social/notification-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { getCurrentProfile } from "@/lib/auth";
import { getNotifications } from "@/lib/db/notifications";

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const notifications = await getNotifications(profile.id, 50);
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        {hasUnread ? (
          <form
            action={async () => {
              "use server";
              await markAllNotificationsRead();
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              {t("markAllRead")}
            </Button>
          </form>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-2">
          {notifications.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
