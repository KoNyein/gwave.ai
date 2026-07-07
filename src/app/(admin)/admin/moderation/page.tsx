import { getTranslations } from "next-intl/server";

import { ReportRow } from "@/components/admin/report-row";
import { Card, CardContent } from "@/components/ui/card";
import { getPendingReports } from "@/lib/db/admin";

export default async function ModerationPage() {
  const t = await getTranslations("admin");
  const reports = await getPendingReports();

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">
        {t("moderationTitle")} ({reports.length})
      </h1>
      <Card>
        <CardContent className="divide-y px-4 py-1">
          {reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("queueEmpty")}
            </p>
          ) : (
            reports.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
