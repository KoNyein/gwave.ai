import { getTranslations } from "next-intl/server";

import { CurrencyConverter } from "@/components/tools/currency-converter";
import { ToolPage } from "@/components/tools/tool-page";
import { getCurrentProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CurrencyPage() {
  const t = await getTranslations("tools");
  const supabase = await createClient();
  const [{ data: rates }, profile] = await Promise.all([
    supabase.from("currency_rates").select("*").order("code"),
    getCurrentProfile(),
  ]);
  const isAdmin = profile ? hasRole(profile.role, "admin") : false;

  return (
    <ToolPage
      title={t("items.currency.name")}
      description={t("items.currency.description")}
      backLabel={t("backToTools")}
    >
      <CurrencyConverter rates={rates ?? []} isAdmin={isAdmin} />
    </ToolPage>
  );
}
