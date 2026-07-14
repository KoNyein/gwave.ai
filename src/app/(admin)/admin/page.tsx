import { getTranslations } from "next-intl/server";

import { AdminCharts } from "@/components/admin/admin-charts";
import { AdminGuide } from "@/components/admin/admin-nav";
import { AdminInfographics } from "@/components/admin/admin-infographics";
import { Demographics } from "@/components/admin/demographics";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAdminActivityStats,
  getAdminStats,
  getDemographicsAge,
  getDemographicsRegion,
} from "@/lib/db/admin";
import { getRevenueByMonth } from "@/lib/db/membership";

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin");
  const [stats, activity, revenue, ageRows, regionRows] = await Promise.all([
    getAdminStats(),
    getAdminActivityStats(),
    getRevenueByMonth(),
    getDemographicsAge(),
    getDemographicsRegion(),
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

      {/* Engagement + commerce + learning */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "DAU (တစ်ရက်)", value: activity.dau, hint: "ယနေ့ တက်ကြွ" },
          { label: "MAU (၃၀ ရက်)", value: activity.mau, hint: `WAU ${activity.wau}` },
          {
            label: "အော်ဒါ",
            value: activity.total_orders,
            hint: `၃၀ရက် ${activity.orders_30d} · ရောက် ${activity.delivered_orders}`,
          },
          {
            label: "သင်ခန်းစာ ပြီးမြောက်",
            value: activity.lessons_completed,
            hint: `လက်မှတ် ${activity.certificates_issued} · သင်ယူသူ ${activity.active_learners_30d}`,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">
                {stat.value.toLocaleString("en-US")}
              </p>
              <p className="text-[11px] text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Infographic summary — donut + funnels */}
      <AdminInfographics
        totalUsers={stats.totalUsers}
        activeMembers={stats.activeMembers}
        dau={activity.dau}
        wau={activity.wau}
        mau={activity.mau}
        totalOrders={activity.total_orders}
        orders30d={activity.orders_30d}
        deliveredOrders={activity.delivered_orders}
        lessonsCompleted={activity.lessons_completed}
        certificatesIssued={activity.certificates_issued}
        activeLearners30d={activity.active_learners_30d}
      />

      <Demographics age={ageRows} region={regionRows} />

      <AdminCharts
        signupsByDay={stats.signupsByDay}
        postsByDay={stats.postsByDay}
        revenue={revenue}
      />

      <AdminGuide />
    </div>
  );
}
