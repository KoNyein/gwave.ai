import { getTranslations } from "next-intl/server";

import { NutrientCalculator } from "@/components/tools/nutrient-calculator";
import { ToolPage } from "@/components/tools/tool-page";
import { requireMembership } from "@/lib/auth";

export default async function NutrientCalculatorPage() {
  // Member-only tool (Phase 4 gate): non-members land on /membership.
  await requireMembership();
  const t = await getTranslations("tools");
  return (
    <ToolPage
      title={t("items.nutrient.name")}
      description={t("items.nutrient.description")}
      backLabel={t("backToTools")}
    >
      <NutrientCalculator />
    </ToolPage>
  );
}
