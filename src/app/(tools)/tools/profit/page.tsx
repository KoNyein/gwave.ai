import { getTranslations } from "next-intl/server";

import { ProfitCalculator } from "@/components/tools/profit-calculator";
import { ToolPage } from "@/components/tools/tool-page";

export default async function ProfitPage() {
  const t = await getTranslations("tools");
  return (
    <ToolPage
      title={t("items.profit.name")}
      description={t("items.profit.description")}
      backLabel={t("backToTools")}
    >
      <ProfitCalculator />
    </ToolPage>
  );
}
