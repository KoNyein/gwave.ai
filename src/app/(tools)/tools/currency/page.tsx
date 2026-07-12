import { getTranslations } from "next-intl/server";

import { CurrencyConverter } from "@/components/tools/currency-converter";
import { ToolPage } from "@/components/tools/tool-page";
import { getCurrentProfile, hasRole } from "@/lib/auth";
import { getActiveCurrencies } from "@/lib/db/currency";

export const dynamic = "force-dynamic";

export default async function CurrencyPage() {
  const t = await getTranslations("tools");
  const [currencies, profile] = await Promise.all([
    getActiveCurrencies(),
    getCurrentProfile(),
  ]);
  const isAdmin = profile ? hasRole(profile.role, "admin") : false;

  return (
    <ToolPage
      title={t("items.currency.name")}
      description={t("items.currency.description")}
      backLabel={t("backToTools")}
      guide={[
        "1 G-Pay = 1 MMK — အမြဲ ချိတ်ဆက် (pegged)။",
        "ငွေကြေး (from/to) ရွေး — ကိုယ့်နိုင်ငံ auto-detect။",
        "Fiat + Crypto (BTC/ETH/USDT) ပါ တွက်နိုင်။",
      ]}
    >
      <CurrencyConverter currencies={currencies} isAdmin={isAdmin} />
    </ToolPage>
  );
}
