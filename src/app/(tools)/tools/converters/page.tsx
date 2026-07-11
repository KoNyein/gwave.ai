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
      guide={[
        "ပြောင်းချင်သော အတိုင်းအတာ အမျိုးအစား (အလေးချိန် / အလျား / အပူချိန် …) ရွေးပါ။",
        "တန်ဖိုးကို ရိုက်ထည့်ပါ။",
        "ပြောင်းလဲထားသော တန်ဖိုးများ ချက်ချင်း ပေါ်လာမည်။",
      ]}
    >
      <UnitConverters />
    </ToolPage>
  );
}
