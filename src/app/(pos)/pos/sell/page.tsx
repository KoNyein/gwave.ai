import { redirect } from "next/navigation";

import { SellScreen } from "@/components/pos/sell-screen";
import { requireUser } from "@/lib/auth";
import {
  getCategories,
  getCustomers,
  getMyStore,
  getOpenShift,
  getProducts,
} from "@/lib/db/pos";

export default async function SellPage() {
  const user = await requireUser();
  const context = await getMyStore(user.id);
  if (!context) redirect("/pos");

  const [products, categories, customers, shift] = await Promise.all([
    getProducts(context.store.id),
    getCategories(context.store.id),
    getCustomers(context.store.id),
    getOpenShift(context.store.id),
  ]);

  return (
    <SellScreen
      store={context.store}
      products={products}
      categories={categories}
      customers={customers}
      shift={shift}
    />
  );
}
