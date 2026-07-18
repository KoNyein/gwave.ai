import { notFound, redirect } from "next/navigation";

import { ReceiptView } from "@/components/pos/receipt-view";
import { requireUser } from "@/lib/auth";
import { getMyStore, getSale } from "@/lib/db/pos";

export default async function ReceiptPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const user = await requireUser();
  const context = await getMyStore(user.id);
  if (!context) redirect("/pos");

  const sale = await getSale(params.id);
  if (!sale || sale.store_id !== context.store.id) notFound();

  return (
    <ReceiptView
      sale={sale}
      store={context.store}
      canRefund={context.role === "manager"}
    />
  );
}
