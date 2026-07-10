"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const expenseSchema = z.object({
  category: z.enum(["salary", "rent", "utility", "tax", "other"]),
  title: z.string().trim().min(1).max(160),
  amount: z.number().min(0).max(1_000_000_000),
  dueDate: z.string().trim().max(20).optional().or(z.literal("")),
  recurring: z.boolean().optional(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

/** Create a new expense for the caller. */
export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("business_expenses").insert({
    owner_id: userId,
    category: v.category,
    title: v.title,
    amount: v.amount,
    due_date: v.dueDate ? v.dueDate : null,
    recurring: v.recurring ?? false,
    note: v.note ? v.note : null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance");
  return { ok: true, data: undefined };
}

/** Toggle an expense's paid status (records paid_at when marking paid). */
export async function toggleExpensePaid(input: {
  id: string;
  isPaid: boolean;
}): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(input.id).success) {
    return { ok: false, error: "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_expenses")
    .update({
      is_paid: input.isPaid,
      paid_at: input.isPaid ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance");
  return { ok: true, data: undefined };
}

/** Delete an expense. */
export async function deleteExpense(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_expenses")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance");
  return { ok: true, data: undefined };
}
