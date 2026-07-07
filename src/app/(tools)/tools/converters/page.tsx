import { getTranslations } from "next-intl/server";

import { ToolPage } from "@/components/tools/tool-page";
import { UnitConverters } from "@/components/tools/unit-converters";

export default async function ConvertersPage() {
  const t = await getTranslations("tools");
  return (
    <ToolPage
      title={t("items.units.name")}
      description={t("items.units.description")}
      backLabel={t("backToTools")}
    >
      <UnitConverters />
    </ToolPage>
  );
}
