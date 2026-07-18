import "server-only";
import { getCurrentUser } from "@/lib/auth";

import { createClient } from "@/lib/supabase/server";
import type { GpayAccount, GpayTransaction, GpayTxnKind } from "@/types/database";

/** A party (account) on one side of a transaction, for the admin ledger. */
export interface GpayTxnParty {
  user_id: string;
  full_name: string;
  phone: string;
}

/** A transaction with both parties resolved — admin-only detail view. */
export interface GpayTxnDetail {
  id: string;
  kind: GpayTxnKind;
  amount: number;
  note: string | null;
  created_at: string;
  from: GpayTxnParty | null;
  to: GpayTxnParty | null;
}

/**
 * Every G-Pay transaction with both parties named. Admin-only: RLS on
 * gpay_transactions already returns all rows to admins, and gpay_accounts is
 * admin-readable, so the embedded joins resolve.
 */
export async function getAllGpayTransactions(
  limit = 300,
): Promise<GpayTxnDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gpay_transactions")
    .select(
      "id, kind, amount, note, created_at, from:gpay_accounts!gpay_transactions_from_account_fkey(user_id, full_name, phone), to:gpay_accounts!gpay_transactions_to_account_fkey(user_id, full_name, phone)",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<GpayTxnDetail[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The caller's own G-Pay account (RLS-scoped), or null if not registered. */
export async function getMyGpayAccount(): Promise<GpayAccount | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("gpay_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<GpayAccount>();
  if (error) throw new Error(error.message);
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
  const { data, error } = await supabase
    .from("gpay_transactions")
    .select("*")
    .or(`from_account.eq.${accountId},to_account.eq.${accountId}`)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<GpayTransaction[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Admin review queue: every account, newest first (RLS lets admins read all). */
export async function getAllGpayAccounts(): Promise<GpayAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gpay_accounts")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<GpayAccount[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
