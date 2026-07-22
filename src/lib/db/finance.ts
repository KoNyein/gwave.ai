import "server-only";
import { getCurrentUser } from "@/lib/auth";

import { createClient } from "@/lib/data/server";
import type { BusinessExpense, ExpenseCategory } from "@/types/database";

/** All of the caller's expenses, unpaid (soonest due) first, then paid. */
export async function getMyExpenses(): Promise<BusinessExpense[]> {
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await db
    .from("business_expenses")
    .select("*")
    .eq("owner_id", user.id)
    .order("is_paid", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<BusinessExpense[]>();
  return data ?? [];
}

export interface MonthlyTotals {
  byCategory: Record<ExpenseCategory, number>;
  total: number;
  unpaidTotal: number;
}

/** Totals for the current calendar month, grouped by category. */
export function summariseMonth(expenses: BusinessExpense[]): MonthlyTotals {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const byCategory: Record<ExpenseCategory, number> = {
    salary: 0,
    rent: 0,
    utility: 0,
    tax: 0,
    other: 0,
  };
  let total = 0;
  let unpaidTotal = 0;
  const nextMonthStart = new Date(y, m + 1, 1);
  for (const e of expenses) {
    const start = new Date(e.due_date ?? e.created_at);
    // A monthly-recurring cost counts every month from its start onward (so
    // rent/salary added earlier isn't dropped); a one-off counts only in its
    // own month.
    const counts = e.recurring
      ? start < nextMonthStart
      : start.getFullYear() === y && start.getMonth() === m;
    if (!counts) continue;
    byCategory[e.category] += e.amount;
    total += e.amount;
    if (!e.is_paid) unpaidTotal += e.amount;
  }
  return { byCategory, total, unpaidTotal };
}
