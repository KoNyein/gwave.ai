import Link from "next/link";
import { getTranslations } from "next-intl/server";

import {
  FeatureFlagsEditor,
  SiteNameForm,
} from "@/components/admin/settings-forms";
import { ThemePicker } from "@/components/admin/theme-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuditLogs, getSiteName, getSiteTheme } from "@/lib/db/admin";
import { displayName, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage() {
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const [siteName, siteTheme, flagsRes, auditLogs] = await Promise.all([
    getSiteName(),
    getSiteTheme(),
    supabase.from("feature_flags").select("*").order("key"),
    getAuditLogs(100),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("settingsTitle")}</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("generalSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SiteNameForm initialName={siteName} />
          <p className="text-sm text-muted-foreground">
            {t("currencyRatesHint")}{" "}
            <Link
              href="/tools/currency"
              className="font-medium text-primary hover:underline"
            >
              {t("currencyRatesLink")}
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("themeTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemePicker current={siteTheme} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("featureFlags")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureFlagsEditor flags={flagsRes.data ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("auditLogs")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y px-4 py-1">
          {auditLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noAuditLogs")}
            </p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="py-2 text-sm">
                <p>
                  <span className="font-semibold">
                    {log.actor ? displayName(log.actor) : "system"}
                  </span>{" "}
                  <span className="font-mono text-xs">{log.action}</span>
                  {log.target_type ? (
                    <span className="text-muted-foreground">
                      {" "}
                      → {log.target_type} {log.target_id?.slice(0, 8)}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(log.created_at)}
                  {Object.keys(log.detail).length > 0
                    ? ` · ${JSON.stringify(log.detail)}`
                    : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
