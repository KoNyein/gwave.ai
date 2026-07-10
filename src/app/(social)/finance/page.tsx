import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FinanceClient } from "@/components/finance/finance-client";
import { getCurrentProfile } from "@/lib/auth";
import { getMyExpenses, summariseMonth } from "@/lib/db/finance";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const t = await getTranslations("finance");

  const expenses = await getMyExpenses();
  const totals = summariseMonth(expenses);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <FinanceClient expenses={expenses} totals={totals} />
    </div>
  );
}
