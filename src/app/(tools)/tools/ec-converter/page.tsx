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
      guide={[
        "EC တန်ဖိုး (mS/cm) ကို ရိုက်ထည့်ပါ။",
        "PPM(500) သို့မဟုတ် PPM(700) ကွက်ကို ရိုက်ရင်လည်း EC ကို ပြန်တွက်ပေးသည်။",
        "ဟိုက်ဒရိုပိုးနစ် အာဟာရရည် စစ်ဆေးရာတွင် သုံးပါ။ တန်ဖိုးကို သိမ်းထားပြီး ပြန်လာရင် မှတ်မိပါသည်။",
      ]}
    >
      <EcConverter />
    </ToolPage>
  );
}
