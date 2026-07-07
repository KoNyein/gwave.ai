import { getTranslations } from "next-intl/server";

import { AdminCharts } from "@/components/admin/admin-charts";
import { Card, CardContent } from "@/components/ui/card";
import { getAdminStats } from "@/lib/db/admin";
import { getRevenueByMonth } from "@/lib/db/membership";

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin");
  const [stats, revenue] = await Promise.all([
    getAdminStats(),
    getRevenueByMonth(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("overviewTitle")}</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: t("totalUsers"), value: stats.totalUsers },
          { label: t("newUsers7d"), value: stats.newUsers7d },
          { label: t("totalPosts"), value: stats.totalPosts },
          { label: t("activeMembers"), value: stats.activeMembers },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminCharts
        signupsByDay={stats.signupsByDay}
        postsByDay={stats.postsByDay}
        revenue={revenue}
      />
    </div>
  );
}
