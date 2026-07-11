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
      guide={[
        "အပူချိန် (°C) နဲ့ စိုထိုင်းဆ (RH %) ကို ထည့်ပါ။",
        "အရွက်အပူချိန် ကွာဟမှုကို ချိန်ညှိနိုင်သည်။",
        "VPD (kPa) ရလဒ်ဖြင့် အပင်ပတ်ဝန်းကျင် သင့်တော်မှုကို စစ်ဆေးပါ။",
      ]}
    >
      <VpdCalculator />
    </ToolPage>
  );
}
