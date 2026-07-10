import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { GpayAccount, GpayTransaction } from "@/types/database";

/** The caller's own G-Pay account (RLS-scoped), or null if not registered. */
export async function getMyGpayAccount(): Promise<GpayAccount | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("gpay_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<GpayAccount>();
  return data ?? null;
}

/**
 * A single account's transaction history (either side), newest first.
 * Always filter by the account id explicitly: RLS lets an admin read every
 * ledger row, so without this an admin's own wallet would show unrelated
 * users' transactions.
 */
export async function getGpayTransactions(
  accountId: string,
  limit = 50,
): Promise<GpayTransaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gpay_transactions")
    .select("*")
    .or(`from_account.eq.${accountId},to_account.eq.${accountId}`)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<GpayTransaction[]>();
  return data ?? [];
}

/** Admin review queue: every account, newest first (RLS lets admins read all). */
export async function getAllGpayAccounts(): Promise<GpayAccount[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gpay_accounts")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<GpayAccount[]>();
  return data ?? [];
}
