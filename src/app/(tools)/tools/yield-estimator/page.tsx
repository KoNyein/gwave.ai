import { getTranslations } from "next-intl/server";

import { ToolPage } from "@/components/tools/tool-page";
import { YieldEstimator } from "@/components/tools/yield-estimator";
import { requireMembership } from "@/lib/auth";

export default async function YieldEstimatorPage() {
  // Member-only tool (Phase 4 gate): non-members land on /membership.
  await requireMembership();
  const t = await getTranslations("tools");
  return (
    <ToolPage
      title={t("items.yield.name")}
      description={t("items.yield.description")}
      backLabel={t("backToTools")}
    >
      <YieldEstimator />
    </ToolPage>
  );
}
