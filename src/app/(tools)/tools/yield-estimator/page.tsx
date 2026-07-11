import { getTranslations } from "next-intl/server";

import { ToolPage } from "@/components/tools/tool-page";
import { YieldEstimator } from "@/components/tools/yield-estimator";

export default async function YieldEstimatorPage() {
  const t = await getTranslations("tools");
  return (
    <ToolPage
      title={t("items.yield.name")}
      description={t("items.yield.description")}
      backLabel={t("backToTools")}
      guide={[
        "အပင်အရေအတွက်နဲ့ တစ်ပင်ချင်း အထွက်နှုန်း ခန့်မှန်းချက်ကို ထည့်ပါ။",
        "ဧရိယာ / ဝပ်အား စသည်ဖြင့် ချိန်ညှိပါ။",
        "ခန့်မှန်း စုစုပေါင်း အထွက် ရလဒ်ကို ကြည့်ပါ။",
      ]}
    >
      <YieldEstimator />
    </ToolPage>
  );
}
