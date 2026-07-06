import { getTranslations } from "next-intl/server";

import { EcConverter } from "@/components/tools/ec-converter";
import { ToolPage } from "@/components/tools/tool-page";

export default async function EcConverterPage() {
  const t = await getTranslations("tools");
  return (
    <ToolPage
      title={t("items.ec.name")}
      description={t("items.ec.description")}
      backLabel={t("backToTools")}
    >
      <EcConverter />
    </ToolPage>
  );
}
