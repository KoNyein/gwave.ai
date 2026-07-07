import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ReportsView } from "@/components/pos/reports-view";
import { requireUser } from "@/lib/auth";
import { getMyStore, getReport } from "@/lib/db/pos";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const t = await getTranslations("pos");
  const user = await requireUser();
  const context = await getMyStore(user.id);
  if (!context) redirect("/pos");
  if (context.role !== "manager") redirect("/pos/sell");

  const fallback = defaultRange();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from ?? "")
    ? searchParams.from!
    : fallback.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to ?? "")
    ? searchParams.to!
    : fallback.to;

  const report = await getReport(context.store.id, from, to);

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("reportsTitle")}</h1>
      <ReportsView
        report={report}
        currency={context.store.currency}
        from={from}
        to={to}
      />
    </div>
  );
}
