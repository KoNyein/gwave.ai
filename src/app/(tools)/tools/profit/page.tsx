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
      guide={[
        "ကုန်ကျစရိတ် (cost) နဲ့ ရောင်းဈေး (price) ကို ထည့်ပါ။",
        "အမြတ် နဲ့ margin % ကို တွက်ပြသည်။",
        "ဈေးနှုန်း သတ်မှတ်ရာတွင် သုံးပါ။ တန်ဖိုးများ သိမ်းထားပြီး ပြန်လာရင် မှတ်မိသည်။",
      ]}
    >
      <ProfitCalculator />
    </ToolPage>
  );
}
