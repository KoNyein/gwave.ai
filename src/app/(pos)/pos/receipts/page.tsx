import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getMyStore, getSales } from "@/lib/db/pos";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ReceiptsPage() {
  const t = await getTranslations("pos");
  const user = await requireUser();
  const context = await getMyStore(user.id);
  if (!context) redirect("/pos");

  const sales = await getSales(context.store.id);

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("receiptsTitle")}</h1>
      <Card>
        <CardContent className="divide-y px-4 py-1">
          {sales.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noSales")}
            </p>
          ) : (
            sales.map((sale) => (
              <Link
                key={sale.id}
                href={`/pos/receipts/${sale.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-muted"
              >
                <div>
                  <p className="text-sm font-semibold">
                    #{sale.receipt_number}
                    {sale.customer ? ` · ${sale.customer.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("itemCount", { count: sale.items.length })} ·{" "}
                    {timeAgo(sale.created_at)} ·{" "}
                    {sale.payments.map((payment) => payment.method).join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">
                    {Number(sale.total).toFixed(2)} {context.store.currency}
                  </p>
                  <p
                    className={cn(
                      "text-xs capitalize",
                      sale.status === "refunded"
                        ? "font-semibold text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {t(`saleStatus.${sale.status}`)}
                  </p>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
