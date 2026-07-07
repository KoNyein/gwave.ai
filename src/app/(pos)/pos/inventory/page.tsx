import { redirect } from "next/navigation";

import { InventoryManager } from "@/components/pos/inventory-manager";
import { requireUser } from "@/lib/auth";
import { getCategories, getMyStore, getProducts } from "@/lib/db/pos";

export default async function InventoryPage() {
  const user = await requireUser();
  const context = await getMyStore(user.id);
  if (!context) redirect("/pos");
  if (context.role !== "manager") redirect("/pos/sell");

  const [products, categories] = await Promise.all([
    getProducts(context.store.id, true),
    getCategories(context.store.id),
  ]);

  return (
    <InventoryManager
      store={context.store}
      products={products}
      categories={categories}
    />
  );
}
