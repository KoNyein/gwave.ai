import { redirect } from "next/navigation";

import { CreateStoreCard } from "@/components/pos/create-store-card";
import { requireUser } from "@/lib/auth";
import { getMyStore } from "@/lib/db/pos";

export default async function PosEntryPage() {
  const user = await requireUser();
  const context = await getMyStore(user.id);
  if (context) redirect("/pos/sell");

  return <CreateStoreCard />;
}
