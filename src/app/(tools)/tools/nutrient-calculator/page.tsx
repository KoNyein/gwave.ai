import { getTranslations } from "next-intl/server";

import { NutrientCalculator } from "@/components/tools/nutrient-calculator";
import { ToolPage } from "@/components/tools/tool-page";

export default async function NutrientCalculatorPage() {
  const t = await getTranslations("tools");
  return (
    <ToolPage
      title={t("items.nutrient.name")}
      description={t("items.nutrient.description")}
      backLabel={t("backToTools")}
      guide={[
        "ရေ ပမာဏ (လီတာ) နဲ့ လိုချင်သော EC ကို ထည့်ပါ။",
        "အာဟာရ အမျိုးအစား / အချိုးကို ရွေးပါ။",
        "ရလဒ်အတိုင်း အာဟာရ ရောစပ်ပါ။ ဖော်မြူလာကို သိမ်းထားနိုင်သည်။",
      ]}
    >
      <NutrientCalculator />
    </ToolPage>
  );
}
