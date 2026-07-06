import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { RuleBuilder } from "@/components/farm/rule-builder";
import { AlertRow, RuleRow } from "@/components/farm/rule-row";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getAlerts, getDevices, getRules } from "@/lib/db/iot";

export default async function RulesPage() {
  const t = await getTranslations("farm");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [devices, rules, alerts] = await Promise.all([
    getDevices(profile.id),
    getRules(profile.id),
    getAlerts(profile.id),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("rulesTitle")}</h1>
        <RuleBuilder devices={devices} />
      </div>

      <Card>
        <CardContent className="divide-y px-4 py-1">
          {rules.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noRules")}
            </p>
          ) : (
            rules.map((rule) => <RuleRow key={rule.id} rule={rule} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("alertsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y px-4 py-1">
          {alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noAlerts")}
            </p>
          ) : (
            alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
