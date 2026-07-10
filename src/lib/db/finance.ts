import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BusinessExpense, ExpenseCategory } from "@/types/database";

/** All of the caller's expenses, unpaid (soonest due) first, then paid. */
export async function getMyExpenses(): Promise<BusinessExpense[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
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
  for (const e of expenses) {
    // Attribute to the month by due date when present, else created date.
    const d = new Date(e.due_date ?? e.created_at);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    byCategory[e.category] += e.amount;
    total += e.amount;
    if (!e.is_paid) unpaidTotal += e.amount;
  }
  return { byCategory, total, unpaidTotal };
}
