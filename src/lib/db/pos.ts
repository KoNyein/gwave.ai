import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Inventory,
  PosCategory,
  PosCustomer,
  PosProduct,
  Sale,
  SaleItem,
  SalePayment,
  Shift,
  Store,
  StoreRole,
} from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface StoreContext {
  store: Store;
  role: StoreRole; // owner counts as manager
}

/** The user's store (owned or joined) and their effective role. */
export async function getMyStore(userId: string): Promise<StoreContext | null> {
  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (owned) return { store: owned, role: "manager" };

  const { data: membership } = await supabase
    .from("store_members")
    .select("role, store:stores!store_members_store_id_fkey(*)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{ role: StoreRole; store: Store }>();
  if (membership?.store) {
    return { store: membership.store, role: membership.role };
  }
  return null;
}

export interface ProductWithStock extends PosProduct {
  inventory: Inventory | null;
}

export async function getProducts(
  storeId: string,
  includeInactive = false,
): Promise<ProductWithStock[]> {
  const supabase = await createClient();
  let query = supabase
    .from("pos_products")
    .select("*, inventory(*)")
    .eq("store_id", storeId)
    .order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data } = await query.returns<ProductWithStock[]>();
  return data ?? [];
}

export async function getCategories(storeId: string): Promise<PosCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pos_categories")
    .select("*")
    .eq("store_id", storeId)
    .order("sort_order")
    .order("name");
  return data ?? [];
}

export async function getCustomers(storeId: string): Promise<PosCustomer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pos_customers")
    .select("*")
    .eq("store_id", storeId)
    .order("name")
    .limit(200);
  return data ?? [];
}

export async function getOpenShift(storeId: string): Promise<Shift | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*")
    .eq("store_id", storeId)
    .is("closed_at", null)
    .maybeSingle();
  return data;
}

export async function getShifts(storeId: string, limit = 30): Promise<Shift[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*")
    .eq("store_id", storeId)
    .order("opened_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface SaleWithRelations extends Sale {
  items: SaleItem[];
  payments: SalePayment[];
  cashier: AuthorSummary | null;
  customer: PosCustomer | null;
}

const SALE_SELECT = `
  *,
  items:sale_items(*),
  payments:sale_payments(*),
  cashier:profiles!sales_cashier_id_fkey(id, username, full_name, avatar_url),
  customer:pos_customers!sales_customer_id_fkey(*)
`;

export async function getSales(
  storeId: string,
  limit = 50,
): Promise<SaleWithRelations[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<SaleWithRelations[]>();
  return data ?? [];
}

export async function getSale(
  saleId: string,
): Promise<SaleWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select(SALE_SELECT)
    .eq("id", saleId)
    .maybeSingle<SaleWithRelations>();
  return data;
}

/** Cash-payment total for the current shift (for reconciliation). */
export async function getShiftCashSales(shiftId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("id, payments:sale_payments(method, amount)")
    .eq("shift_id", shiftId)
    .eq("status", "completed")
    .returns<{ id: string; payments: SalePayment[] }[]>();
  let total = 0;
  for (const sale of data ?? []) {
    for (const payment of sale.payments) {
      if (payment.method === "cash") total += Number(payment.amount);
    }
  }
  return Math.round(total * 100) / 100;
}

export interface ReportData {
  totalSales: number;
  transactionCount: number;
  byDay: { day: string; total: number }[];
  byMethod: { method: string; total: number }[];
  byCategory: { category: string; total: number }[];
  topItems: { name: string; quantity: number; total: number }[];
}

/** Aggregated sales report for a date range (inclusive). */
export async function getReport(
  storeId: string,
  from: string,
  to: string,
): Promise<ReportData> {
  const supabase = await createClient();
  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999`).toISOString();

  const { data: sales } = await supabase
    .from("sales")
    .select(
      `id, total, created_at,
       items:sale_items(name, quantity, total, product:pos_products(category_id)),
       payments:sale_payments(method, amount)`,
    )
    .eq("store_id", storeId)
    .eq("status", "completed")
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .limit(5000)
    .returns<
      {
        id: string;
        total: number;
        created_at: string;
        items: {
          name: string;
          quantity: number;
          total: number;
          product: { category_id: string | null } | null;
        }[];
        payments: { method: string; amount: number }[];
      }[]
    >();

  const { data: categories } = await supabase
    .from("pos_categories")
    .select("id, name")
    .eq("store_id", storeId);
  const categoryNames = new Map(
    (categories ?? []).map((category) => [category.id, category.name]),
  );

  const byDay = new Map<string, number>();
  const byMethod = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const topItems = new Map<string, { quantity: number; total: number }>();
  let totalSales = 0;

  for (const sale of sales ?? []) {
    totalSales += Number(sale.total);
    const day = sale.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(sale.total));
    for (const payment of sale.payments) {
      byMethod.set(
        payment.method,
        (byMethod.get(payment.method) ?? 0) + Number(payment.amount),
      );
    }
    for (const item of sale.items) {
      const categoryName = item.product?.category_id
        ? (categoryNames.get(item.product.category_id) ?? "Uncategorized")
        : "Uncategorized";
      byCategory.set(
        categoryName,
        (byCategory.get(categoryName) ?? 0) + Number(item.total),
      );
      const entry = topItems.get(item.name) ?? { quantity: 0, total: 0 };
      entry.quantity += Number(item.quantity);
      entry.total += Number(item.total);
      topItems.set(item.name, entry);
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    totalSales: round(totalSales),
    transactionCount: sales?.length ?? 0,
    byDay: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, total]) => ({ day, total: round(total) })),
    byMethod: [...byMethod.entries()].map(([method, total]) => ({
      method,
      total: round(total),
    })),
    byCategory: [...byCategory.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([category, total]) => ({ category, total: round(total) })),
    topItems: [...topItems.entries()]
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 10)
      .map(([name, entry]) => ({
        name,
        quantity: entry.quantity,
        total: round(entry.total),
      })),
  };
}

export interface StoreMemberWithProfile {
  store_id: string;
  user_id: string;
  role: StoreRole;
  profile: AuthorSummary;
}

export async function getStoreMembers(
  storeId: string,
): Promise<StoreMemberWithProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_members")
    .select(
      "*, profile:profiles!store_members_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("store_id", storeId)
    .returns<StoreMemberWithProfile[]>();
  return data ?? [];
}
