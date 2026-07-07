import { getTranslations } from "next-intl/server";

import { ToolPage } from "@/components/tools/tool-page";
import { VpdCalculator } from "@/components/tools/vpd-calculator";

export default async function VpdPage() {
  const t = await getTranslations("tools");
  return (
    <ToolPage
      title={t("items.vpd.name")}
      description={t("items.vpd.description")}
      backLabel={t("backToTools")}
    >
      <VpdCalculator />
    </ToolPage>
  );
}
