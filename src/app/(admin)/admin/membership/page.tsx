import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  GrantForm,
  MemberActions,
  ReviewActions,
} from "@/components/membership/admin-actions";
import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getMembers,
  getMembershipStats,
  getReviewQueue,
  getRevenueByMonth,
} from "@/lib/db/membership";
import { displayName, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function AdminMembershipPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const t = await getTranslations("membershipAdmin");
  const [stats, revenue, queue, members] = await Promise.all([
    getMembershipStats(),
    getRevenueByMonth(),
    getReviewQueue(),
    getMembers(searchParams.q),
  ]);

  // Signed URLs for slips in the private bucket (admin RLS grants read).
  const supabase = await createClient();
  const slipUrls = new Map<string, string>();
  for (const payment of queue) {
    if (payment.slip_path) {
      const { data } = await supabase.storage
        .from("slips")
        .createSignedUrl(payment.slip_path, 3600);
      if (data?.signedUrl) slipUrls.set(payment.id, data.signedUrl);
    }
  }

  const maxRevenue = Math.max(1, ...revenue.map((point) => point.total));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/admin/members.csv" download>
            <Download className="mr-2 h-4 w-4" />
            {t("exportCsv")}
          </a>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("activeMembers"), value: stats.activeMembers },
          { label: t("pendingReviews"), value: stats.pendingReviews },
          {
            label: t("revenueThisMonth"),
            value: `$${stats.revenueThisMonth.toLocaleString()}`,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("revenueByMonth")}</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noRevenue")}
            </p>
          ) : (
            <div className="flex h-40 items-end gap-2">
              {revenue.map((point) => (
                <div
                  key={point.month}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs text-muted-foreground">
                    ${point.total}
                  </span>
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{
                      height: `${Math.max(4, (point.total / maxRevenue) * 120)}px`,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {point.month.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PromptPay review queue */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("reviewQueue")} ({queue.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {queue.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("queueEmpty")}
            </p>
          ) : (
            queue.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar profile={payment.profile} />
                  <div>
                    <p className="text-sm font-semibold">
                      {displayName(payment.profile)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${payment.amount} · {timeAgo(payment.created_at)}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {slipUrls.has(payment.id) ? (
                    <a
                      href={slipUrls.get(payment.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("viewSlip")}
                    </a>
                  ) : null}
                  <ReviewActions paymentId={payment.id} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Manual grant */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("grantTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <GrantForm />
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">
            {t("members")} ({members.length})
          </CardTitle>
          <form action="/admin/membership">
            <Input
              type="search"
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder={t("searchMembers")}
              className="h-8 w-48"
            />
          </form>
        </CardHeader>
        <CardContent className="divide-y">
          {members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noMembers")}
            </p>
          ) : (
            members.map(({ subscription, profile }) => (
              <div
                key={subscription.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <Link
                  href={profile.username ? `/u/${profile.username}` : "#"}
                  className="flex items-center gap-3"
                >
                  <UserAvatar profile={profile} linked={false} />
                  <div>
                    <p className="text-sm font-semibold">
                      {displayName(profile)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {subscription.plan.name} ·{" "}
                      <span
                        className={cn(
                          "capitalize",
                          subscription.status === "active" && "text-primary",
                        )}
                      >
                        {subscription.status.replace("_", " ")}
                      </span>
                      {" · "}
                      {subscription.provider}
                      {subscription.current_period_end
                        ? ` · ${t("until", {
                            date: new Date(
                              subscription.current_period_end,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }),
                          })}`
                        : ""}
                    </p>
                  </div>
                </Link>
                <MemberActions subscriptionId={subscription.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
