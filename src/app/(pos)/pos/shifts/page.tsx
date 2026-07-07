import { redirect } from "next/navigation";

import { ShiftManager } from "@/components/pos/shift-manager";
import { requireUser } from "@/lib/auth";
import {
  getMyStore,
  getOpenShift,
  getShiftCashSales,
  getShifts,
} from "@/lib/db/pos";

export default async function ShiftsPage() {
  const user = await requireUser();
  const context = await getMyStore(user.id);
  if (!context) redirect("/pos");

  const [shift, history] = await Promise.all([
    getOpenShift(context.store.id),
    getShifts(context.store.id),
  ]);
  const cashSales = shift ? await getShiftCashSales(shift.id) : 0;

  return (
    <ShiftManager
      store={context.store}
      openShift={shift}
      cashSales={cashSales}
      history={history}
    />
  );
}
