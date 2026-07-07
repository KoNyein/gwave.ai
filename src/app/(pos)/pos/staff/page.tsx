import { redirect } from "next/navigation";

import { StaffManager } from "@/components/pos/staff-manager";
import { requireUser } from "@/lib/auth";
import { getMyStore, getStoreMembers } from "@/lib/db/pos";

export default async function StaffPage() {
  const user = await requireUser();
  const context = await getMyStore(user.id);
  if (!context) redirect("/pos");
  if (context.role !== "manager") redirect("/pos/sell");

  const members = await getStoreMembers(context.store.id);

  return <StaffManager storeId={context.store.id} members={members} />;
}
