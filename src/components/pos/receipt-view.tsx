"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Printer, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { refundSale } from "@/lib/actions/pos";
import type { SaleWithRelations } from "@/lib/db/pos";
import type { Store } from "@/types/database";

/** 80mm-style printable receipt with print/email/refund actions. */
export function ReceiptView({
  sale,
  store,
  canRefund,
}: {
  sale: SaleWithRelations;
  store: Store;
  canRefund: boolean;
}) {
  const t = useTranslations("pos");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function refund() {
    setError(null);
    startTransition(async () => {
      const result = await refundSale(sale.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const receiptText = [
    store.name,
    `${t("receipt")} #${sale.receipt_number}`,
    new Date(sale.created_at).toLocaleString(),
    "",
    ...sale.items.map(
      (item) =>
        `${item.name} x${Number(item.quantity)} — ${Number(item.total).toFixed(2)}`,
    ),
    "",
    `${t("total")}: ${Number(sale.total).toFixed(2)} ${store.currency}`,
  ].join("\n");

  return (
    <div className="mx-auto max-w-sm space-y-4">
      {/* Actions (hidden when printing) */}
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" className="flex-1" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          {t("print")}
        </Button>
        <Button variant="outline" className="flex-1" asChild>
          <a
            href={`mailto:${sale.customer?.email ?? ""}?subject=${encodeURIComponent(
              `${store.name} — ${t("receipt")} #${sale.receipt_number}`,
            )}&body=${encodeURIComponent(receiptText)}`}
          >
            <Mail className="mr-2 h-4 w-4" />
            {t("email")}
          </a>
        </Button>
        {canRefund && sale.status === "completed" ? (
          <Button
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={refund}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="mr-2 h-4 w-4" />
            )}
            {t("refund")}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive print:hidden">{error}</p>
      ) : null}

      {/* 80mm receipt */}
      <div className="mx-auto w-[302px] rounded-lg border bg-white p-4 font-mono text-xs text-black shadow-sm print:w-full print:border-0 print:shadow-none">
        <div className="text-center">
          <p className="text-sm font-bold">{store.name}</p>
          <p>
            {t("receipt")} #{sale.receipt_number}
          </p>
          <p>{new Date(sale.created_at).toLocaleString()}</p>
          {sale.cashier ? (
            <p>
              {t("cashier")}: {sale.cashier.full_name ?? sale.cashier.username}
            </p>
          ) : null}
          {sale.customer ? (
            <p>
              {t("customer")}: {sale.customer.name}
            </p>
          ) : null}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        {sale.items.map((item) => (
          <div key={item.id} className="mb-1">
            <p>{item.name}</p>
            <div className="flex justify-between">
              <span>
                {Number(item.quantity)} × {Number(item.price).toFixed(2)}
                {Number(item.discount) > 0
                  ? ` −${Number(item.discount).toFixed(2)}`
                  : ""}
              </span>
              <span>{Number(item.total).toFixed(2)}</span>
            </div>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-black" />

        <div className="flex justify-between">
          <span>{t("subtotal")}</span>
          <span>{Number(sale.subtotal).toFixed(2)}</span>
        </div>
        {Number(sale.discount) > 0 ? (
          <div className="flex justify-between">
            <span>{t("cartDiscount")}</span>
            <span>−{Number(sale.discount).toFixed(2)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-sm font-bold">
          <span>{t("total")}</span>
          <span>
            {Number(sale.total).toFixed(2)} {store.currency}
          </span>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        {sale.payments.map((payment) => (
          <div key={payment.id} className="flex justify-between">
            <span className="uppercase">{payment.method}</span>
            <span>{Number(payment.amount).toFixed(2)}</span>
          </div>
        ))}

        {sale.status === "refunded" ? (
          <p className="mt-2 text-center text-sm font-bold">
            *** {t("refunded").toUpperCase()} ***
          </p>
        ) : null}

        {store.receipt_footer ? (
          <p className="mt-3 text-center">{store.receipt_footer}</p>
        ) : null}
        <p className="mt-2 text-center">{t("thankYou")}</p>
      </div>
    </div>
  );
}
